import { ethers } from "hardhat";

interface DeploymentAddresses {
  mockDOGE: string;
  mockWDOGE: string;
  crossChainHTLC: string;
  fusionPlusAdapter: string;
  dogeChainBridge: string;
  mockResolver: string;
}

async function main() {
  console.log("🐕 Starting DogeChain deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  const deploymentAddresses: DeploymentAddresses = {
    mockDOGE: "",
    mockWDOGE: "",
    crossChainHTLC: "",
    fusionPlusAdapter: "",
    dogeChainBridge: "",
    mockResolver: ""
  };

  // 1. Deploy Mock DOGE token for testing
  console.log("\n🪙 Deploying Mock DOGE...");
  
  const MockDOGE = await ethers.getContractFactory("MockDOGE");
  const mockDOGE = await MockDOGE.deploy();
  await mockDOGE.waitForDeployment();
  deploymentAddresses.mockDOGE = await mockDOGE.getAddress();
  console.log("✅ Mock DOGE deployed to:", deploymentAddresses.mockDOGE);

  // Deploy wrapped DOGE for testing
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockWDOGE = await MockERC20.deploy(
    "Wrapped Dogecoin",
    "WDOGE",
    8, // 8 decimals like DOGE
    ethers.parseUnits("1000000", 8), // 1M initial supply
    0 // No max supply (unlimited like real DOGE)
  );
  await mockWDOGE.waitForDeployment();
  deploymentAddresses.mockWDOGE = await mockWDOGE.getAddress();
  console.log("✅ Mock WDOGE deployed to:", deploymentAddresses.mockWDOGE);

  // 2. Deploy CrossChainHTLC
  console.log("\n🔗 Deploying CrossChainHTLC...");
  
  const CrossChainHTLC = await ethers.getContractFactory("CrossChainHTLC");
  const crossChainHTLC = await CrossChainHTLC.deploy(deployer.address); // Fee recipient
  await crossChainHTLC.waitForDeployment();
  deploymentAddresses.crossChainHTLC = await crossChainHTLC.getAddress();
  console.log("✅ CrossChainHTLC deployed to:", deploymentAddresses.crossChainHTLC);

  // 3. Deploy DogeChainBridge (configured for DogeChain)
  console.log("\n🌉 Deploying DogeChainBridge...");
  
  const DogeChainBridge = await ethers.getContractFactory("DogeChainBridge");
  const dogeChainBridge = await DogeChainBridge.deploy(
    2, // Required signatures
    3600, // Message timeout (1 hour)
    ethers.parseEther("100"), // Minimum stake (100 DOGE equivalent)
    ethers.parseEther("10") // Slash amount (10 DOGE equivalent)
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
    "DogeChain Test Resolver",
    30, // 0.3% fee (lower for DogeChain)
    ethers.parseUnits("100", 8), // Min amount: 100 DOGE
    ethers.parseUnits("100000", 8) // Max amount: 100k DOGE
  );
  await mockResolver.waitForDeployment();
  deploymentAddresses.mockResolver = await mockResolver.getAddress();
  console.log("✅ MockResolver deployed to:", deploymentAddresses.mockResolver);

  // 6. Setup initial configurations
  console.log("\n⚙️ Setting up initial configurations...");

  // Add Ethereum Sepolia support to FusionPlusAdapter
  await fusionPlusAdapter.addSupportedChain(11155111);
  console.log("✅ Added Ethereum Sepolia support to FusionPlusAdapter");

  // Add initial validator to bridge (deployer as validator for testing)
  await dogeChainBridge.addValidator(deployer.address, ethers.parseEther("100"));
  console.log("✅ Added deployer as initial validator to DogeChainBridge");

  // Mint some test DOGE tokens to deployer
  await mockDOGE.mint(deployer.address, ethers.parseUnits("100000", 8));
  console.log("✅ Minted 100,000 DOGE to deployer");

  // Mint some test WDOGE tokens
  await mockWDOGE.mint(deployer.address, ethers.parseUnits("50000", 8));
  console.log("✅ Minted 50,000 WDOGE to deployer");

  // Enable faucets for easy testing
  await mockDOGE.setFaucetEnabled(true);
  await mockWDOGE.setFaucetEnabled(true);
  console.log("✅ Enabled faucets for test tokens");

  // 7. Setup cross-chain token mappings
  console.log("\n🔄 Setting up token mappings...");

  // Load Ethereum deployment addresses if available
  const fs = require('fs');
  const path = require('path');
  const ethereumDeploymentPath = path.join(__dirname, '..', 'deployments', 'ethereum-sepolia.json');
  
  if (fs.existsSync(ethereumDeploymentPath)) {
    const ethereumDeployment = JSON.parse(fs.readFileSync(ethereumDeploymentPath, 'utf8'));
    
    // Add token mappings (DogeChain -> Ethereum)
    await dogeChainBridge.addTokenMapping(
      568, // DogeChain testnet
      deploymentAddresses.mockDOGE,
      11155111, // Ethereum Sepolia
      "0x0000000000000000000000000000000000000000" // ETH (native)
    );
    
    await dogeChainBridge.addTokenMapping(
      568, // DogeChain testnet
      deploymentAddresses.mockWDOGE,
      11155111, // Ethereum Sepolia
      ethereumDeployment.contracts.MockUSDC.address
    );
    
    console.log("✅ Added cross-chain token mappings");
  } else {
    console.log("⚠️ Ethereum deployment not found, skipping token mappings");
  }

  // 8. Verification preparations
  console.log("\n📝 Preparing verification data...");
  
  const verificationData = {
    network: "dogechain_testnet",
    contracts: {
      MockDOGE: {
        address: deploymentAddresses.mockDOGE,
        constructorArgs: []
      },
      MockWDOGE: {
        address: deploymentAddresses.mockWDOGE,
        constructorArgs: [
          "Wrapped Dogecoin",
          "WDOGE",
          8,
          ethers.parseUnits("1000000", 8).toString(),
          "0"
        ]
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
          ethers.parseEther("100").toString(),
          ethers.parseEther("10").toString()
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
          "DogeChain Test Resolver",
          30,
          ethers.parseUnits("100", 8).toString(),
          ethers.parseUnits("100000", 8).toString()
        ]
      }
    }
  };

  // Save deployment addresses to file
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'dogechain-testnet.json'),
    JSON.stringify(verificationData, null, 2)
  );
  
  console.log("✅ Deployment data saved to deployments/dogechain-testnet.json");

  // 9. Display summary
  console.log("\n🎉 DogeChain Deployment Complete!");
  console.log("=" .repeat(50));
  console.log("Network: DogeChain Testnet");
  console.log("Deployer:", deployer.address);
  console.log("\nContract Addresses:");
  console.log("Mock DOGE:", deploymentAddresses.mockDOGE);
  console.log("Mock WDOGE:", deploymentAddresses.mockWDOGE);
  console.log("CrossChainHTLC:", deploymentAddresses.crossChainHTLC);
  console.log("DogeChainBridge:", deploymentAddresses.dogeChainBridge);
  console.log("FusionPlusAdapter:", deploymentAddresses.fusionPlusAdapter);
  console.log("MockResolver:", deploymentAddresses.mockResolver);
  
  console.log("\n📖 Next Steps:");
  console.log("1. Verify contracts: npm run verify:dogechain");
  console.log("2. Test cross-chain functionality");
  console.log("3. Start frontend development");
  
  console.log("\n💡 Test Commands:");
  console.log("- Get DOGE from faucet: call faucet() on Mock DOGE");
  console.log("- Get WDOGE from faucet: call faucet() on Mock WDOGE");
  console.log("- Create cross-chain order: use FusionPlusAdapter");
  console.log("- Test HTLC: use CrossChainHTLC");

  console.log("\n🌐 Network Info:");
  console.log("Chain ID: 568");
  console.log("RPC URL: https://rpc-testnet.dogechain.dog");
  console.log("Explorer: https://explorer-testnet.dogechain.dog");
  console.log("Faucet: https://faucet.dogechain.dog");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ DogeChain deployment failed:", error);
    process.exit(1);
  });