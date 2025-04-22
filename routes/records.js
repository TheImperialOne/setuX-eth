require('dotenv').config(); 
const express = require("express");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const os = require('os');
const AWS = require('aws-sdk');

const { contract } = require("../backend/config");
const { addMedicalRecordAsHospital } = require("../utils/contractHelpers");
const { uploadToFilebase, listPatientFiles, downloadFile } = require("../backend/filebase");
const crypto = require("crypto");

const router = express.Router();
console.log('Checking environment variables...');
console.log({
  FILEBASE_ACCESS_KEY: process.env.FILEBASE_ACCESS_KEY ? '***' + process.env.FILEBASE_ACCESS_KEY.slice(-4) : 'MISSING',
  FILEBASE_SECRET_KEY: process.env.FILEBASE_SECRET_KEY ? '***' + process.env.FILEBASE_SECRET_KEY.slice(-4) : 'MISSING',
  FILEBASE_BUCKET: process.env.FILEBASE_BUCKET || 'MISSING'
});
// Configure AWS for Filebase
AWS.config.update({
  accessKeyId: process.env.FILEBASE_ACCESS_KEY,
  secretAccessKey: process.env.FILEBASE_SECRET_KEY,
  region: 'us-east-1'
});

const s3 = new AWS.S3({
  endpoint: 'https://s3.filebase.com',
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
});

// ✅ Firebase admin init
if (!admin.apps.length) {
  const serviceAccount = require(path.resolve(__dirname, "../backend/firebase-service-account.json"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const firestore = admin.firestore();

// ✅ Upload medical record (no file upload, only fileURL passed)
const { FilebaseClient } = require('@filebase/client'); // Assuming you're using Filebase SDK

// ✅ Upload medical record with Filebase storage
router.post("/uploadRecord", async (req, res) => {
  const { email, date, doctor, details, prescription, diagnosis, treatment, hospitalName, fileURL, hospitalEmail } = req.body;

  // Validate required fields
  if (!email || !date || !doctor || !hospitalEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), 'medical-records');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  let tempFilePath = '';
  try {
    // 1. Build record object
    const recordData = {
      email: email.toLowerCase().trim(),
      date,
      doctor,
      details: details || '',
      prescription: prescription || '',
      diagnosis: diagnosis || '',
      treatment: treatment || '',
      hospitalName: hospitalName || '',
      fileURL: fileURL || '',
      hospitalEmail: hospitalEmail.toLowerCase().trim(),
      createdAt: new Date().toISOString()
    };

    // 2. Upload to Filebase
    const timestamp = Date.now();
    const fileName = `${timestamp}_${email.replace(/[@.]/g, '-')}_at_${hospitalName.replace(/\s+/g, '-')}.json`;
    tempFilePath = path.join(tempDir, fileName);

    fs.writeFileSync(tempFilePath, JSON.stringify(recordData, null, 2));
    
    const fileContent = fs.readFileSync(tempFilePath);
    const uploadResponse = await s3.upload({
      Bucket: process.env.FILEBASE_BUCKET,
      Key: `medical-records/${fileName}`,
      Body: fileContent,
      ContentType: 'application/json',
      Metadata: {
        'patient-email': email,
        'hospital-email': hospitalEmail
      }
    }).promise();

    // 3. Generate record hash
    const recordHash = crypto.createHash("sha256")
      .update(JSON.stringify(recordData))
      .digest("hex");

    // 4. Get wallet addresses (only for blockchain operation)
    const [patientDoc, hospitalDoc] = await Promise.all([
      firestore.collection("WalletMappings").doc(recordData.email).get(),
      firestore.collection("WalletMappings").doc(recordData.hospitalEmail).get()
    ]);

    if (!patientDoc.exists || !hospitalDoc.exists) {
      return res.status(404).json({ 
        error: "Wallet not found",
        missing: !patientDoc.exists ? 'patient' : 'hospital'
      });
    }

    const patientWallet = patientDoc.data().walletAddress;
    const hospitalWallet = hospitalDoc.data().walletAddress;

    // 5. Add to blockchain only
    const tx = await addMedicalRecordAsHospital(
      hospitalEmail,
      email,
      date,
      recordHash
    );

    res.status(200).json({
      success: true,
      message: "Record processed successfully",
      recordHash,
      filebaseURL: uploadResponse.Location,
      txHash: tx.hash,
      patientAddress: patientWallet,
      hospitalAddress: hospitalWallet
    });

  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ 
      error: "Processing failed",
      details: process.env.NODE_ENV === 'development' ? err.message : 'Contact support'
    });
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

router.get("/debug/wallets", async (req, res) => {
  try {
    // Get all documents in WalletMappings collection
    const snapshot = await firestore.collection("WalletMappings").get();
    
    if (snapshot.empty) {
      return res.json({ message: "No wallet mappings found", count: 0 });
    }

    // Format all documents for inspection
    const allWallets = snapshot.docs.map(doc => ({
      documentId: doc.id,
      email: doc.data().email || 'No email field', // Some docs might use ID as email
      walletAddress: doc.data().walletAddress,
      role: doc.data().role,
      // Include all other fields
      ...doc.data()
    }));

    res.json({
      count: allWallets.length,
      wallets: allWallets,
      suggestions: [
        "Check if patient email exists as document ID or in email field",
        "Verify walletAddress exists for each record",
        "Look for case sensitivity in email matches"
      ]
    });

  } catch (err) {
    console.error("Debug error:", err);
    res.status(500).json({ 
      error: "Failed to fetch wallet mappings",
      details: err.message 
    });
  }
});

router.get("/records/full/:email", async (req, res) => {
  const email = decodeURIComponent(req.params.email).replace(/^:/, '').trim().toLowerCase();
  
  try {
    // 1. Verify patient exists
    const walletDoc = await firestore.collection("WalletMappings").doc(email).get();
    if (!walletDoc.exists) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // 2. List all files in Filebase for this patient
    const safeEmail = email.replace(/[@.]/g, '-');
    const prefix = `medical-records/`;
    
    const listParams = {
      Bucket: process.env.FILEBASE_BUCKET,
      Prefix: prefix
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();
    
    // 3. Filter files matching our naming pattern for this patient
    const patientFiles = listedObjects.Contents.filter(file => {
      const filename = file.Key.replace(prefix, '');
      return filename.startsWith('1') && // Starts with timestamp
             filename.includes(`_${safeEmail}_at_`) && 
             filename.endsWith('.json');
    });

    // 4. Fetch and parse each matching file
    const records = await Promise.all(
      patientFiles.map(async (file) => {
        try {
          const getParams = {
            Bucket: process.env.FILEBASE_BUCKET,
            Key: file.Key
          };
          
          const fileData = await s3.getObject(getParams).promise();
          const record = JSON.parse(fileData.Body.toString());
          
          return {
            ...record,
            filebaseKey: file.Key,
            lastModified: file.LastModified,
            size: file.Size
          };
        } catch (err) {
          console.error(`Error processing file ${file.Key}:`, err);
          return null;
        }
      })
    );

    // 5. Filter out failed fetches and sort by timestamp
    const validRecords = records.filter(r => r !== null)
      .sort((a, b) => {
        const timestampA = parseInt(a.filebaseKey.split('_')[0]);
        const timestampB = parseInt(b.filebaseKey.split('_')[0]);
        return timestampB - timestampA; // Newest first
      });

    res.json({
      success: true,
      patient: email,
      recordCount: validRecords.length,
      records: validRecords
    });

  } catch (err) {
    console.error("Records retrieval failed:", {
      email,
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ 
      error: "Failed to retrieve records",
      details: process.env.NODE_ENV === 'development' ? err.message : 'Contact support'
    });
  }
});

// ✅ Assign a wallet to user (hospital or patient)
async function assignWallet(email, role) {
  try {
    const walletPath = path.resolve(__dirname, "../backend/wallets.json");
    const wallets = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    const availableWallet = wallets.find(w => !w.used);

    if (!availableWallet) throw new Error("No wallets left");

    availableWallet.used = true;
    fs.writeFileSync(walletPath, JSON.stringify(wallets, null, 2));

    // Save wallet mapping
    await firestore.collection("WalletMappings").doc(email).set({
      walletAddress: availableWallet.walletAddress,
      role
    });

    console.log(`✅ Wallet assigned to ${role}: ${availableWallet.walletAddress}`);
    return { walletAddress: availableWallet.walletAddress };
  } catch (err) {
    console.error(`❌ Failed to assign wallet for ${email}:`, err.message);
    throw err;
  }
}

// ✅ Hospital registration route
router.post("/register/hospital", async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Hospital name and email are required" });
  }

  try {
    const { walletAddress } = await assignWallet(email, "hospital");

    // Save in Hospitals collection
    await firestore.collection("Hospitals").doc(email).set(
      { name, walletAddress },
      { merge: true }
    );

    console.log(`✅ Hospital ${name} registered with wallet ${walletAddress}`);
    res.json({ success: true, walletAddress });
  } catch (err) {
    console.error("❌ Hospital registration error:", err.message);
    res.status(500).json({ error: "Hospital registration failed" });
  }
});

// ✅ Patient registration route
router.post("/register/patient", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const { walletAddress } = await assignWallet(email, "patient");

    // Save in Patients collection
    await firestore.collection("Patients").doc(email).set(
      { walletAddress },
      { merge: true }
    );

    console.log(`✅ Patient registered with wallet ${walletAddress}`);
    res.json({ success: true, walletAddress });
  } catch (err) {
    console.error("❌ Patient registration error:", err.message);
    res.status(500).json({ error: "Patient registration failed" });
  }
});

module.exports = router;
