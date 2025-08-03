import { ethers } from "hardhat";
import { Contract } from "ethers";

interface DeploymentAddresses {
  mockERC20: string;
  mockWETH: string;
  crossChainHTLC: string;
  fusionPlusAdapter: string;
  dogeChainBridge: string;
  mockResolver: string;
}

async function main() {
  console.log("🚀 Starting Ethereum deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  const deploymentAddresses: DeploymentAddresses = {
    mockERC20: "",
    mockWETH: "",
    crossChainHTLC: "",
    fusionPlusAdapter: "",
    dogeChainBridge: "",
    mockResolver: ""
  };

  // 1. Deploy Mock Tokens for testing
  console.log("\n📋 Deploying Mock Tokens...");
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy(
    "Mock USDC",
    "USDC",
    6, // 6 decimals like real USDC
    ethers.parseUnits("1000000", 6), // 1M initial supply
    ethers.parseUnits("100000000", 6) // 100M max supply
  );
  await mockUSDC.waitForDeployment();
  deploymentAddresses.mockERC20 = await mockUSDC.getAddress();
  console.log("✅ Mock USDC deployed to:", deploymentAddresses.mockERC20);

  const MockWETH = await ethers.getContractFactory("MockWETH");
  const mockWETH = await MockWETH.deploy();
  await mockWETH.waitForDeployment();
  deploymentAddresses.mockWETH = await mockWETH.getAddress();
  console.log("✅ Mock WETH deployed to:", deploymentAddresses.mockWETH);

  // 2. Deploy CrossChainHTLC
  console.log("\n🔗 Deploying CrossChainHTLC...");
  
  const CrossChainHTLC = await ethers.getContractFactory("CrossChainHTLC");
  const crossChainHTLC = await CrossChainHTLC.deploy(deployer.address); // Fee recipient
  await crossChainHTLC.waitForDeployment();
  deploymentAddresses.crossChainHTLC = await crossChainHTLC.getAddress();
  console.log("✅ CrossChainHTLC deployed to:", deploymentAddresses.crossChainHTLC);

  // 3. Deploy DogeChainBridge
  console.log("\n🌉 Deploying DogeChainBridge...");
  
  const DogeChainBridge = await ethers.getContractFactory("DogeChainBridge");
  const dogeChainBridge = await DogeChainBridge.deploy(
    2, // Required signatures
    3600, // Message timeout (1 hour)
    ethers.parseEther("1"), // Minimum stake (1 ETH)
    ethers.parseEther("0.1") // Slash amount (0.1 ETH)
  );
  await dogeChainBridge.waitForDeployment();
  deploymentAddresses.dogeChainBridge = await dogeChainBridge.getAddress();
  console.log("✅ DogeChainBridge deployed to:", deploymentAddresses.dogeChainBridge);

  // 4. Deploy FusionPlusAdapter
  console.log("\n⚡ Deploying FusionPlusAdapter...");
  
  const FusionPlusAdapter = await ethers.getContractFactory("FusionPlusAdapter");
  const fusionPlusAdapter = await FusionPlusAdapter.deploy(
    deploymentAddresses.crossChainHTLC,
    deployer.address // Fee recipient
  );
  await fusionPlusAdapter.waitForDeployment();
  deploymentAddresses.fusionPlusAdapter = await fusionPlusAdapter.getAddress();
  console.log("✅ FusionPlusAdapter deployed to:", deploymentAddresses.fusionPlusAdapter);

  // 5. Deploy MockResolver for testing
  console.log("\n🔄 Deploying MockResolver...");
  
  const MockResolver = await ethers.getContractFactory("MockResolver");
  const mockResolver = await MockResolver.deploy(
    "Test Resolver",
    50, // 0.5% fee
    ethers.parseEther("0.01"), // Min amount: 0.01 ETH
    ethers.parseEther("10") // Max amount: 10 ETH
  );
  await mockResolver.waitForDeployment();
  deploymentAddresses.mockResolver = await mockResolver.getAddress();
  console.log("✅ MockResolver deployed to:", deploymentAddresses.mockResolver);

  // 6. Setup initial configurations
  console.log("\n⚙️ Setting up initial configurations...");

  // Add DogeChain testnet support to FusionPlusAdapter
  await fusionPlusAdapter.addSupportedChain(568);
  console.log("✅ Added DogeChain testnet support to FusionPlusAdapter");

  // Add initial validator to bridge (deployer as validator for testing)
  await dogeChainBridge.addValidator(deployer.address, ethers.parseEther("1"));
  console.log("✅ Added deployer as initial validator to DogeChainBridge");

  // Mint some test tokens to deployer
  await mockUSDC.mint(deployer.address, ethers.parseUnits("10000", 6));
  console.log("✅ Minted 10,000 USDC to deployer");

  // Wrap some ETH to WETH for testing
  await mockWETH.deposit({ value: ethers.parseEther("1") });
  console.log("✅ Wrapped 1 ETH to WETH");

  // 7. Verification preparations
  console.log("\n📝 Preparing verification data...");
  
  const verificationData = {
    network: "sepolia",
    contracts: {
      MockUSDC: {
        address: deploymentAddresses.mockERC20,
        constructorArgs: [
          "Mock USDC",
          "USDC",
          6,
          ethers.parseUnits("1000000", 6).toString(),
          ethers.parseUnits("100000000", 6).toString()
        ]
      },
      MockWETH: {
        address: deploymentAddresses.mockWETH,
        constructorArgs: []
      },
      CrossChainHTLC: {
        address: deploymentAddresses.crossChainHTLC,
        constructorArgs: [deployer.address]
      },
      DogeChainBridge: {
        address: deploymentAddresses.dogeChainBridge,
        constructorArgs: [
          2,
          3600,
          ethers.parseEther("1").toString(),
          ethers.parseEther("0.1").toString()
        ]
      },
      FusionPlusAdapter: {
        address: deploymentAddresses.fusionPlusAdapter,
        constructorArgs: [
          deploymentAddresses.crossChainHTLC,
          deployer.address
        ]
      },
      MockResolver: {
        address: deploymentAddresses.mockResolver,
        constructorArgs: [
          "Test Resolver",
          50,
          ethers.parseEther("0.01").toString(),
          ethers.parseEther("10").toString()
        ]
      }
    }
  };

  // Save deployment addresses to file
  const fs = require('fs');
  const path = require('path');
  
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'ethereum-sepolia.json'),
    JSON.stringify(verificationData, null, 2)
  );
  
  console.log("✅ Deployment data saved to deployments/ethereum-sepolia.json");

  // 8. Display summary
  console.log("\n🎉 Ethereum Deployment Complete!");
  console.log("=" .repeat(50));
  console.log("Network: Ethereum Sepolia");
  console.log("Deployer:", deployer.address);
  console.log("\nContract Addresses:");
  console.log("Mock USDC:", deploymentAddresses.mockERC20);
  console.log("Mock WETH:", deploymentAddresses.mockWETH);
  console.log("CrossChainHTLC:", deploymentAddresses.crossChainHTLC);
  console.log("DogeChainBridge:", deploymentAddresses.dogeChainBridge);
  console.log("FusionPlusAdapter:", deploymentAddresses.fusionPlusAdapter);
  console.log("MockResolver:", deploymentAddresses.mockResolver);
  
  console.log("\n📖 Next Steps:");
  console.log("1. Verify contracts: npm run verify:ethereum");
  console.log("2. Deploy to DogeChain: npm run deploy:dogechain");
  console.log("3. Run frontend: npm run dev:frontend");
  
  console.log("\n💡 Test Commands:");
  console.log("- Get USDC from faucet: call faucet() on Mock USDC");
  console.log("- Create test order: use FusionPlusAdapter.createCrossChainOrder()");
  console.log("- Test HTLC: use CrossChainHTLC.createHTLC()");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });