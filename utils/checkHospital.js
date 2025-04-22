const { contract, signer } = require("../backend/config");

(async () => {
  try {
    const address = await signer.getAddress();
    const isHosp = await contract.isHospital(address);
    console.log("Signer address:", address);
    console.log("Is hospital?", isHosp);
  } catch (err) {
    console.error("❌ Error checking hospital status:", err.message || err);
  }
})();
