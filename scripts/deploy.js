const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

// 🔌 Connect to local Ganache instance
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// 🧱 Load compiled contract (run `npx hardhat compile` first)
const contractJson = require("../artifacts/contracts/SetuXRecords.sol/SetuXRecords.json");

(async () => {
  try {
    console.log("🚀 Deploying SetuXRecords contract to local Ganache...");

    const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
    const contract = await factory.deploy();

    console.log("⏳ Waiting for contract to be mined...");
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    const txHash = contract.deploymentTransaction().hash;

    console.log("✅ Contract deployed successfully!");
    console.log("📍 Contract Address:", contractAddress);
    console.log("🧾 Transaction Hash:", txHash);

    // 💾 Save ABI + contract address to backend
    fs.writeFileSync(
      "./backend/abi/SetuXRecords.json",
      JSON.stringify({ abi: contractJson.abi, address: contractAddress }, null, 2)
    );
    console.log("📦 ABI & address saved to: backend/abi/SetuXRecords.json");

  } catch (err) {
    console.error("❌ Deployment failed:", err);
  }
})();
