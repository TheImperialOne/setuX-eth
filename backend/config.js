// config.js
const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
  throw new Error("❌ Missing environment variables: RPC_URL or PRIVATE_KEY");
}

// Load ABI and Contract Address
const abiJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "abi", "SetuXRecords.json"))
);
const abi = abiJson.abi;

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = process.env.CONTRACT_ADDRESS;

const contract = new ethers.Contract(contractAddress, abi, signer);

module.exports = { contract, signer };
