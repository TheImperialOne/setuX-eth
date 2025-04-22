const { contract } = require("./backend/config");

async function addMedicalRecord(patientAddress, date, recordHash) {
  try {
    console.log("Adding record for:", {
      patientAddress,
      date,
      recordHash: recordHash.substring(0, 10) + "..."
    });

    // First estimate gas
    const gasEstimate = await contract.addRecord.estimateGas(
      patientAddress, 
      date, 
      recordHash
    );
    console.log("Gas estimate:", gasEstimate.toString());

    // Send with buffer
    const tx = await contract.addRecord(patientAddress, date, recordHash, {
      gasLimit: gasEstimate.mul(2)
    });
    
    console.log("Tx submitted:", tx.hash);
    const receipt = await tx.wait();
    console.log("Tx confirmed in block:", receipt.blockNumber);
    
    return tx.hash;
  } catch (error) {
    console.error("❌ Contract interaction failed:", {
      errorData: error.data,
      reason: error.reason,
      stack: error.stack
    });
    throw error;
  }
}
// 🏥 Register Hospital
const selfRegisterAsHospital = async (hospitalName) => {
  const tx = await contract.selfRegisterAsHospital(hospitalName); // called from your backend wallet
  await tx.wait();
  return tx.hash;
};


// 👤 Register Patient (Self-signup — no params)
async function registerPatient() {
  const tx = await contract.registerPatient(); // patientAddress comes from msg.sender
  await tx.wait();
  return tx.hash;
}

module.exports = {
  addMedicalRecord,
  selfRegisterAsHospital,
  registerPatient
};
