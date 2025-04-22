// utils/hashUtils.js
const crypto = require("crypto");

const generateHash = (record) => {
  if (!record || typeof record !== 'object') {
    throw new Error("Invalid record: must be a non-null object");
  }
  
  try {
    console.log("[hashUtils] Generating hash for record:", 
      JSON.stringify(record, null, 2));
    
    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(record));
    const digest = hash.digest("hex");
    
    console.log("[hashUtils] Generated hash:", digest.substring(0, 10) + "...");
    return digest;
  } catch (error) {
    console.error("[hashUtils] Error generating hash:", error);
    throw error;
  }
};

module.exports = { generateHash };