const { ethers } = require("ethers");
const contractABI = require("../backend/abi/SetuXRecords.json").abi;
const wallets = require("../backend/wallets.json");
const admin = require("firebase-admin");
const serviceAccount = require("../backend/firebase-service-account.json");

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// Contract configuration
const contractAddress = "0xb518C5E82E3C09c500328A15b068680df616F938";
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

async function getContractForEmail(email) {
  try {
    console.log(`Fetching wallet for email: ${email}`);
    const doc = await db.collection("WalletMappings").doc(email).get();
    
    if (!doc.exists) {
      throw new Error(`No wallet found for email: ${email}`);
    }

    const { walletAddress } = doc.data();
    console.log(`Found wallet address: ${walletAddress}`);

    if (!walletAddress) {
      throw new Error("Wallet address is empty in Firestore");
    }

    const walletEntry = wallets.find(w => 
      w.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!walletEntry) {
      throw new Error(`Wallet not found in wallets.json for address: ${walletAddress}`);
    }

    if (!walletEntry.privateKey) {
      throw new Error("Private key missing in wallet entry");
    }

    console.log(`Creating signer for wallet: ${walletAddress.substring(0, 6)}...`);
    const signer = new ethers.Wallet(walletEntry.privateKey, provider);
    
    console.log(`Connecting to contract at ${contractAddress}`);
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    
    // Verify contract is properly initialized
    if (!contract || typeof contract.addRecord !== 'function') {
      throw new Error("Contract initialization failed - addRecord function not found");
    }
    
    return contract;
  } catch (error) {
    console.error("Error in getContractForEmail:", {
      email,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function addMedicalRecordAsHospital(hospitalEmail, patientEmail, date, recordHash) {
    let contract;
    try {
      console.log("Starting record addition...", {
        hospitalEmail,
        patientEmail,
        date,
        recordHash: recordHash?.substring(0, 10) + "..."
      });
  
      // Get wallets from Firestore
      const hospitalDoc = await db.collection("WalletMappings").doc(hospitalEmail).get();
      if (!hospitalDoc.exists) throw new Error("Hospital wallet not found");
      const hospitalWallet = hospitalDoc.data().walletAddress;
  
      const patientDoc = await db.collection("WalletMappings").doc(patientEmail).get();
      if (!patientDoc.exists) throw new Error("Patient wallet not found");
      const patientWallet = patientDoc.data().walletAddress;
  
      console.log("Hospital wallet:", hospitalWallet);
      console.log("Patient wallet:", patientWallet);
  
      // Get contract instance
      contract = await getContractForEmail(hospitalEmail);
      
      // Ensure hospital is registered
      let isHospital = await contract.isHospital(hospitalWallet);
      if (!isHospital) {
        console.log("Hospital not registered - self-registering...");
        const regTx = await contract.selfRegisterAsHospital("Hospital Name");
        await regTx.wait();
        isHospital = true;
        console.log("Hospital registered in tx:", regTx.hash);
      }
  
      // Ensure patient is registered
      let isPatient = await contract.isPatient(patientWallet);
      if (!isPatient) {
        console.log("Patient not registered - registering...");
        const patientEntry = wallets.find(w => 
          w.walletAddress.toLowerCase() === patientWallet.toLowerCase()
        );
        if (!patientEntry) throw new Error("Patient private key not found");
        
        const patientSigner = new ethers.Wallet(patientEntry.privateKey, provider);
        const patientContract = new ethers.Contract(contractAddress, contractABI, patientSigner);
        const regTx = await patientContract.registerPatient();
        await regTx.wait();
        isPatient = true;
        console.log("Patient registered in tx:", regTx.hash);
      }
  
      // Add record
      console.log("Adding medical record...");
      const tx = await contract.addRecord(patientWallet, date, recordHash, {
        gasLimit: 500000 // Fixed gas limit for testing
      });
      
      const receipt = await tx.wait();
      console.log("Record added in tx:", tx.hash);
      return tx.hash;
  
    } catch (error) {
      console.error("Record addition failed:", {
        hospitalWallet,
        patientWallet,
        error: error.message,
        data: error.data
      });
      throw error;
    }
  }

module.exports = {
  getContractForEmail,
  addMedicalRecordAsHospital,
};