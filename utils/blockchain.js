const { addMedicalRecord } = require("../interact");
const { admin, db } = require("../backend/server"); // Import from server.js

const pushMedicalRecord = async (patientEmail, date, recordHash) => {
  try {
    const docRef = db.collection("WalletMappings").doc(patientEmail);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error("Wallet address not found for this patient email");
    }

    const patientAddress = doc.data().walletAddress;
    const txHash = await addMedicalRecord(patientAddress, date, recordHash);

    return { txHash, patientAddress };
  } catch (error) {
    console.error("Error in pushMedicalRecord:", error);
    throw error;
  }
};

module.exports = {
  pushMedicalRecord
};