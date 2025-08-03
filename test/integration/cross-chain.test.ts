import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Cross-Chain Integration Tests", function () {
  let htlcContract: Contract;
  let adapterContract: Contract;
  let bridgeContract: Contract;
  let mockResolver: Contract;
  let mockToken: Contract;
  
  let owner: Signer;
  let alice: Signer; // ETH side user
  let bob: Signer;   // DOGE side user
  let resolver: Signer;
  let validator: Signer;
  let feeRecipient: Signer;

  const secret = ethers.keccak256(ethers.toUtf8Bytes("integration-test-secret"));
  const hashlock = ethers.keccak256(secret);
  const ethAmount = ethers.parseEther("1");
  const dogeAmount = ethers.parseUnits("1000", 8); // 1000 DOGE (8 decimals)

  before(async function () {
    [owner, alice, bob, resolver, validator, feeRecipient] = await ethers.getSigners();
    
    console.log("🚀 Setting up integration test environment...");
    
    // Deploy all contracts
    await deployContracts();
    await setupInitialConfiguration();
    await mintTestTokens();
    
    console.log("✅ Integration test environment ready");
  });

  async function deployContracts() {
    // Deploy Mock Token (representing DOGE)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy(
      "Mock Dogecoin",
      "DOGE",
      8, // DOGE has 8 decimals
      ethers.parseUnits("1000000", 8),
      0 // Unlimited supply
    );
    await mockToken.waitForDeployment();

    // Deploy HTLC
    const CrossChainHTLC = await ethers.getContractFactory("CrossChainHTLC");
    htlcContract = await CrossChainHTLC.deploy(await feeRecipient.getAddress());
    await htlcContract.waitForDeployment();

    // Deploy Bridge
    const DogeChainBridge = await ethers.getContractFactory("DogeChainBridge");
    bridgeContract = await DogeChainBridge.deploy(
      1, // Only 1 signature required for testing
      3600, // 1 hour timeout
      ethers.parseEther("0.1"), // 0.1 ETH minimum stake
      ethers.parseEther("0.01") // 0.01 ETH slash amount
    );
    await bridgeContract.waitForDeployment();

    // Deploy Adapter
    const FusionPlusAdapter = await ethers.getContractFactory("FusionPlusAdapter");
    adapterContract = await FusionPlusAdapter.deploy(
      await htlcContract.getAddress(),
      await feeRecipient.getAddress()
    );
    await adapterContract.waitForDeployment();

    // Deploy Mock Resolver
    const MockResolver = await ethers.getContractFactory("MockResolver");
    mockResolver = await MockResolver.deploy(
      "Integration Test Resolver",
      25, // 0.25% fee
      ethers.parseEther("0.01"), // 0.01 ETH minimum
      ethers.parseEther("100") // 100 ETH maximum
    );
    await mockResolver.waitForDeployment();
  }

  async function setupInitialConfiguration() {
    // Add supported chains
    await adapterContract.connect(owner).addSupportedChain(568); // DogeChain testnet
    
    // Add validator to bridge
    await bridgeContract.connect(owner).addValidator(
      await validator.getAddress(),
      ethers.parseEther("0.1")
    );
    
    // Register resolver
    await adapterContract.connect(resolver).registerResolver(
      568, // DogeChain
      25,  // 0.25% fee
      "0x" // Empty signature for demo
    );
    
    // Setup token mappings in bridge
    await bridgeContract.connect(owner).addTokenMapping(
      31337, // Local hardhat chain
      ethers.ZeroAddress, // ETH
      568, // DogeChain testnet
      await mockToken.getAddress() // DOGE token
    );
  }

  async function mintTestTokens() {
    // Mint tokens to users
    await mockToken.mint(await alice.getAddress(), ethers.parseUnits("10000", 8));
    await mockToken.mint(await bob.getAddress(), ethers.parseUnits("10000", 8));
  }

  describe("End-to-End Cross-Chain Swap", function () {
    let orderId: string;
    let deadline: number;
    let ethHTLCId: string;
    let dogeHTLCId: string;

    it("Should complete full cross-chain swap flow", async function () {
      console.log("\n🔄 Starting end-to-end cross-chain swap test...");
      
      deadline = (await time.latest()) + 7200; // 2 hours
      
      // Step 1: Alice creates cross-chain order (ETH -> DOGE)
      console.log("📝 Step 1: Alice creates cross-chain order");
      
      const tx1 = await adapterContract.connect(alice).createCrossChainOrder(
        ethers.ZeroAddress, // ETH
        await mockToken.getAddress(), // DOGE on destination
        ethAmount,
        dogeAmount,
        568, // DogeChain testnet
        hashlock,
        deadline,
        ethers.ZeroAddress, // Any taker
        { value: ethAmount }
      );
      
      const receipt1 = await tx1.wait();
      expect(receipt1).to.not.be.null;
      
      orderId = await adapterContract.calculateOrderId(
        await alice.getAddress(),
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        ethAmount,
        dogeAmount,
        568,
        deadline,
        0 // First nonce for Alice
      );
      
      // Verify order creation
      const order = await adapterContract.getCrossChainOrder(orderId);
      expect(order.maker).to.equal(await alice.getAddress());
      expect(order.state).to.equal(1); // PENDING
      
      console.log("✅ Order created successfully");

      // Step 2: Bob takes the order as resolver
      console.log("📝 Step 2: Bob takes the cross-chain order");
      
      const resolverInfo = {
        resolver: await resolver.getAddress(),
        fee: 25,
        resolverData: "0x",
        signature: "0x"
      };
      
      const tx2 = await adapterContract.connect(bob).takeCrossChainOrder(
        orderId,
        resolverInfo
      );
      
      const receipt2 = await tx2.wait();
      expect(receipt2).to.not.be.null;
      
      // Verify order matching
      const matchedOrder = await adapterContract.getCrossChainOrder(orderId);
      expect(matchedOrder.state).to.equal(2); // MATCHED
      expect(matchedOrder.htlcId).to.not.equal(ethers.ZeroHash);
      
      ethHTLCId = matchedOrder.htlcId;
      console.log("✅ Order matched, HTLC created on ETH side");

      // Step 3: Simulate DOGE side HTLC creation
      console.log("📝 Step 3: Creating corresponding HTLC on DOGE side");
      
      // Bob creates HTLC on DOGE side (simulated)
      await mockToken.connect(bob).approve(await htlcContract.getAddress(), dogeAmount);
      
      const dogeTimelock = (await time.latest()) + 3600; // 1 hour (shorter than ETH side)
      
      const tx3 = await htlcContract.connect(bob).createHTLC(
        await alice.getAddress(), // Alice will receive DOGE
        await mockToken.getAddress(),
        dogeAmount,
        hashlock,
        dogeTimelock,
        ethHTLCId // Reference to ETH HTLC
      );
      
      const receipt3 = await tx3.wait();
      dogeHTLCId = await htlcContract.calculateContractId(
        await bob.getAddress(),
        await alice.getAddress(),
        await mockToken.getAddress(),
        dogeAmount,
        hashlock,
        dogeTimelock
      );
      
      console.log("✅ DOGE side HTLC created");

      // Step 4: Alice completes the swap by revealing secret
      console.log("📝 Step 4: Alice reveals secret to complete swap");
      
      // Alice withdraws DOGE first (shorter timelock)
      const aliceDogeBalanceBefore = await mockToken.balanceOf(await alice.getAddress());
      
      const tx4 = await htlcContract.connect(alice).withdraw(dogeHTLCId, secret);
      await tx4.wait();
      
      const aliceDogeBalanceAfter = await mockToken.balanceOf(await alice.getAddress());
      expect(aliceDogeBalanceAfter - aliceDogeBalanceBefore).to.be.greaterThan(0);
      
      console.log("✅ Alice withdrew DOGE successfully");

      // Step 5: Bob uses revealed secret to withdraw ETH
      console.log("📝 Step 5: Bob withdraws ETH using revealed secret");
      
      // Get revealed secret
      const revealedSecret = await htlcContract.getRevealedSecret(dogeHTLCId);
      expect(revealedSecret).to.equal(secret);
      
      const bobEthBalanceBefore = await ethers.provider.getBalance(await bob.getAddress());
      
      const tx5 = await htlcContract.connect(bob).withdraw(ethHTLCId, revealedSecret);
      await tx5.wait();
      
      const bobEthBalanceAfter = await ethers.provider.getBalance(await bob.getAddress());
      expect(bobEthBalanceAfter - bobEthBalanceBefore).to.be.closeTo(
        ethAmount - (ethAmount * 10n / 10000n), // Minus protocol fee
        ethers.parseEther("0.01") // Gas tolerance
      );
      
      console.log("✅ Bob withdrew ETH successfully");

      // Step 6: Complete the order in adapter
      console.log("📝 Step 6: Completing order in adapter");
      
      const tx6 = await adapterContract.connect(bob).completeCrossChainOrder(orderId, secret);
      await tx6.wait();
      
      const completedOrder = await adapterContract.getCrossChainOrder(orderId);
      expect(completedOrder.state).to.equal(3); // COMPLETED
      
      console.log("✅ Cross-chain swap completed successfully!");

      // Verify final states
      const ethHTLC = await htlcContract.getHTLC(ethHTLCId);
      const dogeHTLC = await htlcContract.getHTLC(dogeHTLCId);
      
      expect(ethHTLC.state).to.equal(2); // WITHDRAWN
      expect(dogeHTLC.state).to.equal(2); // WITHDRAWN
      
      console.log("🎉 End-to-end test completed successfully!");
    });
  });

  describe("Cross-Chain Message Passing", function () {
    it("Should send and verify cross-chain messages", async function () {
      const targetChainId = 568;
      const target = await adapterContract.getAddress();
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint256"],
        ["test message", 12345]
      );

      // Send message
      const tx = await bridgeContract.connect(alice).sendMessage(
        targetChainId,
        target,
        payload
      );
      
      const receipt = await tx.wait();
      const messageHash = await bridgeContract.calculateMessageHash(
        31337, // Source chain
        targetChainId,
        await alice.getAddress(),
        target,
        payload,
        0, // Nonce
        (await ethers.provider.getBlock(receipt.blockNumber)).timestamp
      );

      // Verify message hash calculation
      expect(messageHash).to.be.a("string");
      expect(messageHash).to.have.lengthOf(66);
    });

    it("Should handle validator signatures", async function () {
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const signature = await validator.signMessage(ethers.getBytes(messageHash));
      
      const [isValid, count] = await bridgeContract.verifySignatures(
        messageHash,
        [signature]
      );
      
      expect(isValid).to.be.true;
      expect(count).to.equal(1);
    });
  });

  describe("Resolver Network Simulation", function () {
    it("Should simulate resolver order matching", async function () {
      const testAmount = ethers.parseEther("0.5");
      const testChainId = 568;

      // Get quote from resolver
      const [fee, estimatedTime, canExecute] = await mockResolver.getQuote(
        31337, // Source chain
        testChainId,
        testAmount
      );

      expect(canExecute).to.be.true;
      expect(fee).to.equal(testAmount * 25n / 10000n); // 0.25% fee
      expect(estimatedTime).to.be.greaterThan(0);

      // Simulate order resolution
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("test-order"));
      
      const result = await mockResolver.resolveOrder(
        orderId,
        31337, // Source chain
        testChainId,
        testAmount,
        await alice.getAddress(),
        await bob.getAddress()
      );

      expect(result.success).to.be.true;
      expect(result.executedAmount).to.be.greaterThan(0);
    });

    it("Should check resolver capacity", async function () {
      const amounts = [
        ethers.parseEther("0.1"),
        ethers.parseEther("0.2"),
        ethers.parseEther("0.3")
      ];

      const [canExecuteAll, totalFee] = await mockResolver.checkCapacity(amounts);
      
      expect(canExecuteAll).to.be.true;
      expect(totalFee).to.be.greaterThan(0);
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should handle HTLC timeout scenarios", async function () {
      const shortTimelock = (await time.latest()) + 10; // 10 seconds
      
      // Create HTLC with short timeout
      const contractId = await htlcContract.connect(alice).createHTLC.staticCall(
        await bob.getAddress(),
        ethers.ZeroAddress,
        ethers.parseEther("0.1"),
        hashlock,
        shortTimelock,
        ethers.ZeroHash,
        { value: ethers.parseEther("0.1") }
      );

      await htlcContract.connect(alice).createHTLC(
        await bob.getAddress(),
        ethers.ZeroAddress,
        ethers.parseEther("0.1"),
        hashlock,
        shortTimelock,
        ethers.ZeroHash,
        { value: ethers.parseEther("0.1") }
      );

      // Wait for timeout
      await time.increaseTo(shortTimelock + 1);

      // Should allow refund
      await expect(
        htlcContract.connect(alice).refund(contractId)
      ).to.emit(htlcContract, "HTLCRefunded");
    });

    it("Should handle order cancellation", async function () {
      const deadline = (await time.latest()) + 3600;
      
      const orderId = await adapterContract.connect(alice).createCrossChainOrder.staticCall(
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        ethers.parseEther("0.1"),
        ethers.parseUnits("100", 8),
        568,
        hashlock,
        deadline,
        ethers.ZeroAddress,
        { value: ethers.parseEther("0.1") }
      );

      await adapterContract.connect(alice).createCrossChainOrder(
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        ethers.parseEther("0.1"),
        ethers.parseUnits("100", 8),
        568,
        hashlock,
        deadline,
        ethers.ZeroAddress,
        { value: ethers.parseEther("0.1") }
      );

      // Cancel order
      await expect(
        adapterContract.connect(alice).cancelCrossChainOrder(orderId)
      ).to.emit(adapterContract, "CrossChainOrderCancelled");
    });

    it("Should handle bridge pause scenarios", async function () {
      // Pause bridge
      await bridgeContract.connect(owner).pauseBridge();
      expect(await bridgeContract.paused()).to.be.true;

      // Should reject new messages
      await expect(
        bridgeContract.connect(alice).sendMessage(
          568,
          await adapterContract.getAddress(),
          "0x1234"
        )
      ).to.be.revertedWithCustomError(bridgeContract, "EnforcedPause");

      // Unpause
      await bridgeContract.connect(owner).unpauseBridge();
      expect(await bridgeContract.paused()).to.be.false;
    });
  });

  describe("Performance and Gas Optimization", function () {
    it("Should measure gas costs for common operations", async function () {
      console.log("\n⛽ Gas Cost Analysis:");

      // HTLC creation
      const tx1 = await htlcContract.connect(alice).createHTLC(
        await bob.getAddress(),
        ethers.ZeroAddress,
        ethers.parseEther("0.1"),
        hashlock,
        (await time.latest()) + 3600,
        ethers.ZeroHash,
        { value: ethers.parseEther("0.1") }
      );
      const receipt1 = await tx1.wait();
      console.log(`HTLC Creation: ${receipt1.gasUsed} gas`);

      // Order creation
      const tx2 = await adapterContract.connect(alice).createCrossChainOrder(
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        ethers.parseEther("0.1"),
        ethers.parseUnits("100", 8),
        568,
        hashlock,
        (await time.latest()) + 3600,
        ethers.ZeroAddress,
        { value: ethers.parseEther("0.1") }
      );
      const receipt2 = await tx2.wait();
      console.log(`Order Creation: ${receipt2.gasUsed} gas`);

      // Expect reasonable gas costs
      expect(receipt1.gasUsed).to.be.lessThan(500000); // 500k gas
      expect(receipt2.gasUsed).to.be.lessThan(300000); // 300k gas
    });

    it("Should handle multiple concurrent orders", async function () {
      const deadline = (await time.latest()) + 3600;
      const orderCount = 5;
      const orderIds = [];

      console.log(`\n🔄 Creating ${orderCount} concurrent orders...`);

      for (let i = 0; i < orderCount; i++) {
        const orderId = await adapterContract.connect(alice).createCrossChainOrder.staticCall(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          ethers.parseEther("0.01"),
          ethers.parseUnits("10", 8),
          568,
          ethers.keccak256(ethers.toUtf8Bytes(`secret-${i}`)),
          deadline,
          ethers.ZeroAddress,
          { value: ethers.parseEther("0.01") }
        );

        await adapterContract.connect(alice).createCrossChainOrder(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          ethers.parseEther("0.01"),
          ethers.parseUnits("10", 8),
          568,
          ethers.keccak256(ethers.toUtf8Bytes(`secret-${i}`)),
          deadline,
          ethers.ZeroAddress,
          { value: ethers.parseEther("0.01") }
        );

        orderIds.push(orderId);
      }

      // Verify all orders were created
      for (const orderId of orderIds) {
        const order = await adapterContract.getCrossChainOrder(orderId);
        expect(order.state).to.equal(1); // PENDING
      }

      const stats = await adapterContract.getOrderStatistics();
      expect(stats.total).to.be.greaterThanOrEqual(orderCount);

      console.log(`✅ Successfully created ${orderCount} orders`);
    });
  });
});