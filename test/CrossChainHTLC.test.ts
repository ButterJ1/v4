import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("CrossChainHTLC", function () {
  let htlc: Contract;
  let mockToken: Contract;
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let feeRecipient: Signer;
  
  const secret = ethers.keccak256(ethers.toUtf8Bytes("test secret"));
  const hashlock = ethers.keccak256(secret);
  const amount = ethers.parseEther("1");
  const tokenAmount = ethers.parseUnits("100", 6); // 100 USDC

  beforeEach(async function () {
    [owner, alice, bob, feeRecipient] = await ethers.getSigners();

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

    // Mint tokens to Alice
    await mockToken.mint(await alice.getAddress(), ethers.parseUnits("10000", 6));
  });

  describe("Deployment", function () {
    it("Should set the correct fee recipient", async function () {
      expect(await htlc.feeRecipient()).to.equal(await feeRecipient.getAddress());
    });

    it("Should set the correct chain ID", async function () {
      expect(await htlc.CHAIN_ID()).to.equal(31337); // Hardhat chain ID
    });

    it("Should have zero total contracts initially", async function () {
      expect(await htlc.totalContracts()).to.equal(0);
    });
  });

  describe("Native Token HTLC", function () {
    let timelock: number;
    let contractId: string;

    beforeEach(async function () {
      timelock = (await time.latest()) + 3600; // 1 hour from now
      
      // Calculate contract ID
      contractId = await htlc.calculateContractId(
        await alice.getAddress(),
        await bob.getAddress(),
        ethers.ZeroAddress, // Native token
        amount,
        hashlock,
        timelock
      );
    });

    it("Should create HTLC with native tokens", async function () {
      await expect(
        htlc.connect(alice).createHTLC(
          await bob.getAddress(),
          ethers.ZeroAddress,
          amount,
          hashlock,
          timelock,
          ethers.ZeroHash, // counterpart ID
          { value: amount }
        )
      ).to.emit(htlc, "HTLCCreated")
        .withArgs(
          contractId,
          await alice.getAddress(),
          await bob.getAddress(),
          ethers.ZeroAddress,
          amount - (amount * 10n / 10000n), // Amount minus fee
          hashlock,
          timelock,
          31337,
          ethers.ZeroHash
        );

      expect(await htlc.totalContracts()).to.equal(1);
    });

    it("Should allow recipient to withdraw with correct preimage", async function () {
      // Create HTLC
      await htlc.connect(alice).createHTLC(
        await bob.getAddress(),
        ethers.ZeroAddress,
        amount,
        hashlock,
        timelock,
        ethers.ZeroHash,
        { value: amount }
      );

      // Check contract exists and is active
      const [exists, isActive] = await htlc.contractExists(contractId);
      expect(exists).to.be.true;
      expect(isActive).to.be.true;

      // Withdraw
      const bobBalanceBefore = await ethers.provider.getBalance(await bob.getAddress());
      
      await expect(
        htlc.connect(bob).withdraw(contractId, secret)
      ).to.emit(htlc, "HTLCWithdrawn")
        .withArgs(contractId, await bob.getAddress(), secret, amount - (amount * 10n / 10000n));

      const bobBalanceAfter = await ethers.provider.getBalance(await bob.getAddress());
      expect(bobBalanceAfter - bobBalanceBefore).to.be.closeTo(
        amount - (amount * 10n / 10000n),
        ethers.parseEther("0.01") // Gas tolerance
      );

      // Check contract state
      const contract = await htlc.getHTLC(contractId);
      expect(contract.state).to.equal(2); // WITHDRAWN state
    });

    it("Should allow sender to refund after timelock expiry", async function () {
      // Create HTLC
      await htlc.connect(alice).createHTLC(
        await bob.getAddress(),
        ethers.ZeroAddress,
        amount,
        hashlock,
        timelock,
        ethers.ZeroHash,
        { value: amount }
      );

      // Fast forward past timelock
      await time.increaseTo(timelock + 1);

      // Refund
      const aliceBalanceBefore = await ethers.provider.getBalance(await alice.getAddress());
      
      await expect(
        htlc.connect(alice).refund(contractId)
      ).to.emit(htlc, "HTLCRefunded")
        .withArgs(contractId, await alice.getAddress(), amount - (amount * 10n / 10000n));

      const aliceBalanceAfter = await ethers.provider.getBalance(await alice.getAddress());
      expect(aliceBalanceAfter - aliceBalanceBefore).to.be.closeTo(
        amount - (amount * 10n / 10000n),
        ethers.parseEther("0.01") // Gas tolerance
      );
    });

    it("Should reject withdrawal with wrong preimage", async function () {
      // Create HTLC
      await htlc.connect(alice).createHTLC(
        await bob.getAddress(),
        ethers.ZeroAddress,
        amount,
        hashlock,
        timelock,
        ethers.ZeroHash,
        { value: amount }
      );

      const wrongSecret = ethers.keccak256(ethers.toUtf8Bytes("wrong secret"));
      
      await expect(
        htlc.connect(bob).withdraw(contractId, wrongSecret)
      ).to.be.revertedWithCustomError(htlc, "HTLCInvalidHashlock");
    });

    it("Should reject early refund", async function () {
      // Create HTLC
      await htlc.connect(alice).createHTLC(
        await bob.getAddress(),
        ethers.ZeroAddress,
        amount,
        hashlock,
        timelock,
        ethers.ZeroHash,
        { value: amount }
      );

      await expect(
        htlc.connect(alice).refund(contractId)
      ).to.be.revertedWithCustomError(htlc, "HTLCNotExpired");
    });
  });

  describe("ERC20 Token HTLC", function () {
    let timelock: number;
    let contractId: string;

    beforeEach(async function () {
      timelock = (await time.latest()) + 3600;
      
      contractId = await htlc.calculateContractId(
        await alice.getAddress(),
        await bob.getAddress(),
        await mockToken.getAddress(),
        tokenAmount,
        hashlock,
        timelock
      );

      // Approve HTLC contract to spend tokens
      await mockToken.connect(alice).approve(await htlc.getAddress(), tokenAmount);
    });

    it("Should create HTLC with ERC20 tokens", async function () {
      await expect(
        htlc.connect(alice).createHTLC(
          await bob.getAddress(),
          await mockToken.getAddress(),
          tokenAmount,
          hashlock,
          timelock,
          ethers.ZeroHash
        )
      ).to.emit(htlc, "HTLCCreated");

      // Check token balance
      expect(await mockToken.balanceOf(await htlc.getAddress())).to.equal(
        tokenAmount - (tokenAmount * 10n / 10000n) // Minus protocol fee
      );
    });

    it("Should allow ERC20 token withdrawal", async function () {
      // Create HTLC
      await htlc.connect(alice).createHTLC(
        await bob.getAddress(),
        await mockToken.getAddress(),
        tokenAmount,
        hashlock,
        timelock,
        ethers.ZeroHash
      );

      const bobBalanceBefore = await mockToken.balanceOf(await bob.getAddress());
      
      // Withdraw
      await htlc.connect(bob).withdraw(contractId, secret);

      const bobBalanceAfter = await mockToken.balanceOf(await bob.getAddress());
      expect(bobBalanceAfter - bobBalanceBefore).to.equal(
        tokenAmount - (tokenAmount * 10n / 10000n)
      );
    });

    it("Should charge protocol fee correctly", async function () {
      const feeRecipientBalanceBefore = await mockToken.balanceOf(await feeRecipient.getAddress());
      
      await htlc.connect(alice).createHTLC(
        await bob.getAddress(),
        await mockToken.getAddress(),
        tokenAmount,
        hashlock,
        timelock,
        ethers.ZeroHash
      );

      const feeRecipientBalanceAfter = await mockToken.balanceOf(await feeRecipient.getAddress());
      const expectedFee = tokenAmount * 10n / 10000n; // 0.1% fee
      
      expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(expectedFee);
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to set protocol fee", async function () {
      await expect(
        htlc.connect(alice).setProtocolFee(50)
      ).to.be.revertedWithCustomError(htlc, "OwnableUnauthorizedAccount");

      await htlc.connect(owner).setProtocolFee(50);
      expect(await htlc.protocolFee()).to.equal(50);
    });

    it("Should only allow owner to pause contract", async function () {
      await expect(
        htlc.connect(alice).pause()
      ).to.be.revertedWithCustomError(htlc, "OwnableUnauthorizedAccount");

      await htlc.connect(owner).pause();
      expect(await htlc.paused()).to.be.true;
    });

    it("Should reject operations when paused", async function () {
      await htlc.connect(owner).pause();

      const timelock = (await time.latest()) + 3600;
      
      await expect(
        htlc.connect(alice).createHTLC(
          await bob.getAddress(),
          ethers.ZeroAddress,
          amount,
          hashlock,
          timelock,
          ethers.ZeroHash,
          { value: amount }
        )
      ).to.be.revertedWithCustomError(htlc, "EnforcedPause");
    });
  });

  describe("Edge Cases", function () {
    it("Should reject creation with zero amount", async function () {
      const timelock = (await time.latest()) + 3600;
      
      await expect(
        htlc.connect(alice).createHTLC(
          await bob.getAddress(),
          ethers.ZeroAddress,
          0,
          hashlock,
          timelock,
          ethers.ZeroHash,
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(htlc, "HTLCInsufficientBalance");
    });

    it("Should reject creation with past timelock", async function () {
      const pastTimelock = (await time.latest()) - 1000;
      
      await expect(
        htlc.connect(alice).createHTLC(
          await bob.getAddress(),
          ethers.ZeroAddress,
          amount,
          hashlock,
          pastTimelock,
          ethers.ZeroHash,
          { value: amount }
        )
      ).to.be.revertedWithCustomError(htlc, "HTLCInvalidTimelock");
    });

    it("Should reject creation with zero recipient", async function () {
      const timelock = (await time.latest()) + 3600;
      
      await expect(
        htlc.connect(alice).createHTLC(
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          amount,
          hashlock,
          timelock,
          ethers.ZeroHash,
          { value: amount }
        )
      ).to.be.revertedWithCustomError(htlc, "HTLCUnauthorized");
    });

    it("Should reject duplicate contract creation", async function () {
      const timelock = (await time.latest()) + 3600;
      
      await htlc.connect(alice).createHTLC(
        await bob.getAddress(),
        ethers.ZeroAddress,
        amount,
        hashlock,
        timelock,
        ethers.ZeroHash,
        { value: amount }
      );

      await expect(
        htlc.connect(alice).createHTLC(
          await bob.getAddress(),
          ethers.ZeroAddress,
          amount,
          hashlock,
          timelock,
          ethers.ZeroHash,
          { value: amount }
        )
      ).to.be.revertedWithCustomError(htlc, "HTLCAlreadyExists");
    });
  });

  describe("Utility Functions", function () {
    it("Should calculate contract ID correctly", async function () {
      const timelock = (await time.latest()) + 3600;
      
      const calculatedId = await htlc.calculateContractId(
        await alice.getAddress(),
        await bob.getAddress(),
        ethers.ZeroAddress,
        amount,
        hashlock,
        timelock
      );

      expect(calculatedId).to.be.a("string");
      expect(calculatedId).to.have.lengthOf(66); // 0x + 64 chars
    });

    it("Should track user contracts", async function () {
      const timelock = (await time.latest()) + 3600;
      
      await htlc.connect(alice).createHTLC(
        await bob.getAddress(),
        ethers.ZeroAddress,
        amount,
        hashlock,
        timelock,
        ethers.ZeroHash,
        { value: amount }
      );

      const aliceContracts = await htlc.getUserContracts(await alice.getAddress());
      const bobContracts = await htlc.getUserContracts(await bob.getAddress());
      
      expect(aliceContracts.length).to.equal(1);
      expect(bobContracts.length).to.equal(1);
      expect(aliceContracts[0]).to.equal(bobContracts[0]);
    });

    it("Should reveal secret after withdrawal", async function () {
      const timelock = (await time.latest()) + 3600;
      
      const contractId = await htlc.calculateContractId(
        await alice.getAddress(),
        await bob.getAddress(),
        ethers.ZeroAddress,
        amount,
        hashlock,
        timelock
      );

      await htlc.connect(alice).createHTLC(
        await bob.getAddress(),
        ethers.ZeroAddress,
        amount,
        hashlock,
        timelock,
        ethers.ZeroHash,
        { value: amount }
      );

      await htlc.connect(bob).withdraw(contractId, secret);

      const revealedSecret = await htlc.getRevealedSecret(contractId);
      expect(revealedSecret).to.equal(secret);
    });
  });
});