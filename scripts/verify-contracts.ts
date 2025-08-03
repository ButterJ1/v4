import { run } from "hardhat";

interface ContractInfo {
  address: string;
  constructorArgs: any[];
}

interface DeploymentData {
  network: string;
  contracts: Record<string, ContractInfo>;
}

async function verifyContract(name: string, address: string, constructorArgs: any[]) {
  console.log(`🔍 Verifying ${name} at ${address}...`);
  
  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: constructorArgs,
    });
    console.log(`✅ ${name} verified successfully`);
    return true;
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log(`ℹ️ ${name} already verified`);
      return true;
    } else {
      console.error(`❌ Failed to verify ${name}:`, error.message);
      return false;
    }
  }
}

async function main() {
  console.log("🔍 Starting contract verification...");
  
  const network = process.env.HARDHAT_NETWORK;
  if (!network) {
    throw new Error("HARDHAT_NETWORK environment variable not set");
  }
  
  console.log(`Network: ${network}`);

  // Load deployment data
  const fs = require('fs');
  const path = require('path');
  
  let deploymentFile: string;
  if (network === "sepolia") {
    deploymentFile = "ethereum-sepolia.json";
  } else if (network === "dogechain_testnet") {
    deploymentFile = "dogechain-testnet.json";
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  const deploymentPath = path.join(__dirname, '..', 'deployments', deploymentFile);
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }
  
  const deploymentData: DeploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  console.log(`📋 Loaded deployment data for ${deploymentData.network}`);

  // Verify contracts
  const contracts = deploymentData.contracts;
  const results: Record<string, boolean> = {};
  
  console.log("\n🔍 Starting verification process...");
  console.log("=" .repeat(50));

  for (const [contractName, contractInfo] of Object.entries(contracts)) {
    console.log(`\n📝 Processing ${contractName}...`);
    
    // Add delay between verifications to avoid rate limiting
    if (Object.keys(results).length > 0) {
      console.log("⏳ Waiting 5 seconds to avoid rate limiting...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    const success = await verifyContract(
      contractName,
      contractInfo.address,
      contractInfo.constructorArgs
    );
    
    results[contractName] = success;
  }

  // Display results summary
  console.log("\n📊 Verification Results Summary");
  console.log("=" .repeat(50));
  
  const successful = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  for (const [contractName, success] of Object.entries(results)) {
    const status = success ? "✅" : "❌";
    const address = contracts[contractName].address;
    console.log(`${status} ${contractName}: ${address}`);
  }
  
  console.log(`\n📈 Success Rate: ${successful}/${total} (${((successful/total)*100).toFixed(1)}%)`);

  if (successful === total) {
    console.log("\n🎉 All contracts verified successfully!");
    
    // Display explorer links
    console.log("\n🌐 Explorer Links:");
    let explorerBase: string;
    
    if (network === "sepolia") {
      explorerBase = "https://sepolia.etherscan.io/address";
    } else if (network === "dogechain_testnet") {
      explorerBase = "https://explorer-testnet.dogechain.dog/address";
    } else {
      explorerBase = "https://etherscan.io/address";
    }
    
    for (const [contractName, contractInfo] of Object.entries(contracts)) {
      console.log(`${contractName}: ${explorerBase}/${contractInfo.address}`);
    }
    
  } else {
    console.log(`\n⚠️ ${total - successful} contract(s) failed verification`);
    console.log("Please check the errors above and try again");
  }

  // Save verification results
  const verificationResults = {
    network: deploymentData.network,
    timestamp: new Date().toISOString(),
    successful: successful,
    total: total,
    results: results,
    contracts: Object.fromEntries(
      Object.entries(contracts).map(([name, info]) => [
        name,
        {
          ...info,
          verified: results[name],
          explorerUrl: `${network === "sepolia" ? "https://sepolia.etherscan.io" : "https://explorer-testnet.dogechain.dog"}/address/${info.address}`
        }
      ])
    )
  };
  
  const verificationsDir = path.join(__dirname, '..', 'verifications');
  if (!fs.existsSync(verificationsDir)) {
    fs.mkdirSync(verificationsDir, { recursive: true });
  }
  
  const verificationFile = path.join(verificationsDir, `${network}-verification.json`);
  fs.writeFileSync(verificationFile, JSON.stringify(verificationResults, null, 2));
  
  console.log(`\n💾 Verification results saved to: ${verificationFile}`);

  // Display usage instructions
  console.log("\n📖 Next Steps:");
  if (successful === total) {
    console.log("1. ✅ All contracts are verified and ready to use");
    console.log("2. 🚀 Start the frontend: npm run dev:frontend");
    console.log("3. 🧪 Run tests: npm run test");
    console.log("4. 📱 Begin integration testing");
  } else {
    console.log("1. 🔧 Fix verification issues for failed contracts");
    console.log("2. 🔄 Re-run verification: npm run verify:<network>");
    console.log("3. 📞 Contact support if issues persist");
  }

  if (successful < total) {
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("\n✨ Verification process completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Verification process failed:", error);
    process.exit(1);
  });