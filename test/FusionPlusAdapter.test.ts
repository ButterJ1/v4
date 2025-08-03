import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("FusionPlusAdapter", function () {
  let adapter: Contract;
  let htlc: Contract;
  let mockToken: Contract;
  let owner: Signer;
  let maker: Signer;
  let taker: Signer;
  let resolver: Signer;
  let feeRecipient: Signer;
  
  const srcAmount = ethers.parseEther("1");
  const dstAmount = ethers.parseUnits("1000", 6); // 1000 USDC equivalent
  const secret = ethers.keccak256(ethers.toUtf8Bytes("test secret"));
  const hashlock = ethers.keccak256(secret);
  const dstChainId = 568; // DogeChain testnet

  beforeEach(async function () {
    [owner, maker, taker, resolver, feeRecipient] = await ethers.getSigners();

    // Deploy mock token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy(
      "Mock USDC",
      "USDC",
      6,
      ethers.parseUnits("1000000", 6),
      ethers.parseUnits("100000000", 6)
    );
    await mockToken.waitForDeployment();

    // Deploy HTLC contract
    const CrossChainHTLC = await ethers.getContractFactory("CrossChainHTLC");
    htlc = await CrossChainHTLC.deploy(await feeRecipient.getAddress());
    await htlc.waitForDeployment();

    // Deploy FusionPlusAdapter
    const FusionPlusAdapter = await ethers.getContractFactory("FusionPlusAdapter");
    adapter = await FusionPlusAdapter.deploy(
      await htlc.getAddress(),
      await feeRecipient.getAddress()
    );
    await adapter.waitForDeployment();

    // Setup: Add DogeChain testnet as supported chain
    await adapter.connect(owner).addSupportedChain(dstChainId);

    // Mint tokens to maker
    await mockToken.mint(await maker.getAddress(), ethers.parseUnits("10000", 6));
  });

  describe("Deployment", function () {
    it("Should set correct HTLC contract address", async function () {
      expect(await adapter.htlcContract()).to.equal(await htlc.getAddress());
    });

    it("Should set correct chain ID", async function () {
      expect(await adapter.CHAIN_ID()).to.equal(31337); // Hardhat chain ID
    });

    it("Should support DogeChain testnet", async function () {
      expect(await adapter.isChainSupported(dstChainId)).to.be.true;
    });

    it("Should have initial statistics as zero", async function () {
      const stats = await adapter.getOrderStatistics();
      expect(stats.total).to.equal(0);
      expect(stats.completed).to.equal(0);
      expect(stats.cancelled).to.equal(0);
      expect(stats.pending).to.equal(0);
    });
  });

  describe("Cross-Chain Order Creation", function () {
    let deadline: number;

    beforeEach(async function () {
      deadline = (await time.latest()) + 86400; // 24 hours from now
    });

    it("Should create cross-chain order with native tokens", async function () {
      const orderId = await adapter.calculateOrderId(
        await maker.getAddress(),
        ethers.ZeroAddress, // ETH
        await mockToken.getAddress(), // USDC on destination
        srcAmount,
        dstAmount,
        dstChainId,
        deadline,
        0 // First nonce
      );

      await expect(
        adapter.connect(maker).createCrossChainOrder(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          srcAmount,
          dstAmount,
          dstChainId,
          hashlock,
          deadline,
          ethers.ZeroAddress, // Any taker
          { value: srcAmount }
        )
      ).to.emit(adapter, "CrossChainOrderCreated")
        .withArgs(
          orderId,
          await maker.getAddress(),
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          srcAmount,
          dstAmount,
          31337, // Source chain ID
          dstChainId,
          deadline
        );

      // Check order statistics
      const stats = await adapter.getOrderStatistics();
      expect(stats.total).to.equal(1);
      expect(stats.pending).to.equal(1);
    });

    it("Should create cross-chain order with ERC20 tokens", async function () {
      // Approve adapter to spend tokens
      await mockToken.connect(maker).approve(await adapter.getAddress(), srcAmount);

      await expect(
        adapter.connect(maker).createCrossChainOrder(
          await mockToken.getAddress(),
          ethers.ZeroAddress, // Native on destination
          srcAmount,
          dstAmount,
          dstChainId,
          hashlock,
          deadline,
          await taker.getAddress() // Specific taker
        )
      ).to.emit(adapter, "CrossChainOrderCreated");

      // Check token balance
      expect(await mockToken.balanceOf(await adapter.getAddress())).to.equal(srcAmount);
    });

    it("Should reject order with unsupported destination chain", async function () {
      const unsupportedChainId = 999;

      await expect(
        adapter.connect(maker).createCrossChainOrder(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          srcAmount,
          dstAmount,
          unsupportedChainId,
          hashlock,
          deadline,
          ethers.ZeroAddress,
          { value: srcAmount }
        )
      ).to.be.revertedWithCustomError(adapter, "OrderInvalidAmount");
    });

    it("Should reject order with same source and destination chain", async function () {
      await expect(
        adapter.connect(maker).createCrossChainOrder(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          srcAmount,
          dstAmount,
          31337, // Same as source chain
          hashlock,
          deadline,
          ethers.ZeroAddress,
          { value: srcAmount }
        )
      ).to.be.revertedWithCustomError(adapter, "OrderInvalidAmount");
    });

    it("Should reject order with expired deadline", async function () {
      const expiredDeadline = (await time.latest()) - 1000;

      await expect(
        adapter.connect(maker).createCrossChainOrder(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          srcAmount,
          dstAmount,
          dstChainId,
          hashlock,
          expiredDeadline,
          ethers.ZeroAddress,
          { value: srcAmount }
        )
      ).to.be.revertedWithCustomError(adapter, "OrderExpired");
    });
  });

  describe("Order Taking and Matching", function () {
    let orderId: string;
    let deadline: number;

    beforeEach(async function () {
      deadline = (await time.latest()) + 86400;
      
      // Create an order
      await adapter.connect(maker).createCrossChainOrder(
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        srcAmount,
        dstAmount,
        dstChainId,
        hashlock,
        deadline,
        ethers.ZeroAddress,
        { value: srcAmount }
      );

      orderId = await adapter.calculateOrderId(
        await maker.getAddress(),
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        srcAmount,
        dstAmount,
        dstChainId,
        deadline,
        0
      );

      // Register resolver
      await adapter.connect(resolver).registerResolver(
        dstChainId,
        50, // 0.5% fee
        "0x" // Empty signature for demo
      );
    });

    it("Should allow taking a cross-chain order", async function () {
      const resolverInfo = {
        resolver: await resolver.getAddress(),
        fee: 50,
        resolverData: "0x",
        signature: "0x"
      };

      await expect(
        adapter.connect(taker).takeCrossChainOrder(orderId, resolverInfo)
      ).to.emit(adapter, "CrossChainOrderMatched");

      // Check order state
      const order = await adapter.getCrossChainOrder(orderId);
      expect(order.state).to.equal(2); // MATCHED state
    });

    it("Should reject taking expired order", async function () {
      // Fast forward past deadline
      await time.increaseTo(deadline + 1);

      const resolverInfo = {
        resolver: await resolver.getAddress(),
        fee: 50,
        resolverData: "0x",
        signature: "0x"
      };

      await expect(
        adapter.connect(taker).takeCrossChainOrder(orderId, resolverInfo)
      ).to.be.revertedWithCustomError(adapter, "OrderExpired");
    });

    it("Should reject taking with unregistered resolver", async function () {
      const resolverInfo = {
        resolver: await taker.getAddress(), // Unregistered
        fee: 50,
        resolverData: "0x",
        signature: "0x"
      };

      await expect(
        adapter.connect(taker).takeCrossChainOrder(orderId, resolverInfo)
      ).to.be.revertedWithCustomError(adapter, "ResolverNotAuthorized");
    });
  });

  describe("Order Completion", function () {
    let orderId: string;
    let deadline: number;

    beforeEach(async function () {
      deadline = (await time.latest()) + 86400;
      
      // Create and take an order
      await adapter.connect(maker).createCrossChainOrder(
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        srcAmount,
        dstAmount,
        dstChainId,
        hashlock,
        deadline,
        ethers.ZeroAddress,
        { value: srcAmount }
      );

      orderId = await adapter.calculateOrderId(
        await maker.getAddress(),
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        srcAmount,
        dstAmount,
        dstChainId,
        deadline,
        0
      );

      await adapter.connect(resolver).registerResolver(dstChainId, 50, "0x");

      const resolverInfo = {
        resolver: await resolver.getAddress(),
        fee: 50,
        resolverData: "0x",
        signature: "0x"
      };

      await adapter.connect(taker).takeCrossChainOrder(orderId, resolverInfo);
    });

    it("Should complete order with correct preimage", async function () {
      await expect(
        adapter.connect(taker).completeCrossChainOrder(orderId, secret)
      ).to.emit(adapter, "CrossChainOrderCompleted")
        .withArgs(orderId, secret);

      // Check order state
      const order = await adapter.getCrossChainOrder(orderId);
      expect(order.state).to.equal(3); // COMPLETED state

      // Check statistics
      const stats = await adapter.getOrderStatistics();
      expect(stats.completed).to.equal(1);
    });

    it("Should reject completion with wrong preimage", async function () {
      const wrongSecret = ethers.keccak256(ethers.toUtf8Bytes("wrong secret"));

      await expect(
        adapter.connect(taker).completeCrossChainOrder(orderId, wrongSecret)
      ).to.be.revertedWithCustomError(adapter, "OrderInvalidSignature");
    });
  });

  describe("Order Cancellation", function () {
    let orderId: string;
    let deadline: number;

    beforeEach(async function () {
      deadline = (await time.latest()) + 86400;
      
      await adapter.connect(maker).createCrossChainOrder(
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        srcAmount,
        dstAmount,
        dstChainId,
        hashlock,
        deadline,
        ethers.ZeroAddress,
        { value: srcAmount }
      );

      orderId = await adapter.calculateOrderId(
        await maker.getAddress(),
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        srcAmount,
        dstAmount,
        dstChainId,
        deadline,
        0
      );
    });

    it("Should allow maker to cancel pending order", async function () {
      const makerBalanceBefore = await ethers.provider.getBalance(await maker.getAddress());

      await expect(
        adapter.connect(maker).cancelCrossChainOrder(orderId)
      ).to.emit(adapter, "CrossChainOrderCancelled")
        .withArgs(orderId, await maker.getAddress());

      // Check refund
      const makerBalanceAfter = await ethers.provider.getBalance(await maker.getAddress());
      expect(makerBalanceAfter - makerBalanceBefore).to.be.closeTo(
        srcAmount,
        ethers.parseEther("0.01") // Gas tolerance
      );

      // Check statistics
      const stats = await adapter.getOrderStatistics();
      expect(stats.cancelled).to.equal(1);
    });

    it("Should reject cancellation by non-maker", async function () {
      await expect(
        adapter.connect(taker).cancelCrossChainOrder(orderId)
      ).to.be.revertedWithCustomError(adapter, "ResolverNotAuthorized");
    });
  });

  describe("Utility Functions", function () {
    it("Should calculate order ID correctly", async function () {
      const deadline = (await time.latest()) + 86400;
      
      const orderId = await adapter.calculateOrderId(
        await maker.getAddress(),
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        srcAmount,
        dstAmount,
        dstChainId,
        deadline,
        0
      );

      expect(orderId).to.be.a("string");
      expect(orderId).to.have.lengthOf(66); // 0x + 64 chars
    });

    it("Should return supported chains", async function () {
      const supportedChains = await adapter.getSupportedChains();
      expect(supportedChains).to.include(568); // DogeChain testnet
      expect(supportedChains).to.include(11155111); // Ethereum Sepolia (default)
    });

    it("Should check if order can be taken", async function () {
      const deadline = (await time.latest()) + 86400;
      
      await adapter.connect(maker).createCrossChainOrder(
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        srcAmount,
        dstAmount,
        dstChainId,
        hashlock,
        deadline,
        ethers.ZeroAddress,
        { value: srcAmount }
      );

      const orderId = await adapter.calculateOrderId(
        await maker.getAddress(),
        ethers.ZeroAddress,
        await mockToken.getAddress(),
        srcAmount,
        dstAmount,
        dstChainId,
        deadline,
        0
      );

      const [canTake, reason] = await adapter.canTakeOrder(orderId);
      expect(canTake).to.be.true;
      expect(reason).to.equal("");
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to add supported chains", async function () {
      const newChainId = 137; // Polygon

      await expect(
        adapter.connect(maker).addSupportedChain(newChainId)
      ).to.be.revertedWithCustomError(adapter, "OwnableUnauthorizedAccount");

      await adapter.connect(owner).addSupportedChain(newChainId);
      expect(await adapter.isChainSupported(newChainId)).to.be.true;
    });

    it("Should only allow owner to pause contract", async function () {
      await expect(
        adapter.connect(maker).pause()
      ).to.be.revertedWithCustomError(adapter, "OwnableUnauthorizedAccount");

      await adapter.connect(owner).pause();
      expect(await adapter.paused()).to.be.true;
    });

    it("Should reject operations when paused", async function () {
      await adapter.connect(owner).pause();

      const deadline = (await time.latest()) + 86400;

      await expect(
        adapter.connect(maker).createCrossChainOrder(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          srcAmount,
          dstAmount,
          dstChainId,
          hashlock,
          deadline,
          ethers.ZeroAddress,
          { value: srcAmount }
        )
      ).to.be.revertedWithCustomError(adapter, "EnforcedPause");
    });
  });
});