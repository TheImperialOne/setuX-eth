const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  endpoint: "https://s3.filebase.com", // Filebase S3-compatible endpoint
  accessKeyId: process.env.FILEBASE_KEY,
  secretAccessKey: process.env.FILEBASE_SECRET
});

const uploadToFilebase = (fileBuffer, fileName, contentType) => {
  const params = {
    Bucket: "setux",
    Key: fileName,
    Body: fileBuffer,
    ContentType: contentType
  };

  return s3.upload(params).promise();
};

// ✅ List all JSON files uploaded by a patient
const listPatientFiles = async (email) => {
  const prefix = `${email}-`; // File naming format is: email-timestamp-filename
  const params = {
    Bucket: BUCKET_NAME,
    Prefix: prefix
  };
  const response = await s3.listObjectsV2(params).promise();
  return response.Contents.map(obj => obj.Key);
};

// ✅ Download a specific JSON file from Filebase
const downloadFile = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key
  };
  const data = await s3.getObject(params).promise();
  return JSON.parse(data.Body.toString());
};

module.exports = {
    uploadToFilebase,
    listPatientFiles,
    downloadFile
};
  