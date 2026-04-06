const cloudinary = require("cloudinary").v2;

// load credentials from environment to avoid hard‑coding and allow rotation
// make sure your .env file (or hosting environment) defines CLOUDINARY_*
let {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

// trim any whitespace that might have been accidentally included
if (CLOUDINARY_CLOUD_NAME) CLOUDINARY_CLOUD_NAME = CLOUDINARY_CLOUD_NAME.trim();
if (CLOUDINARY_API_KEY) CLOUDINARY_API_KEY = CLOUDINARY_API_KEY.trim();
if (CLOUDINARY_API_SECRET) CLOUDINARY_API_SECRET = CLOUDINARY_API_SECRET.trim();

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn(
    "WARNING: Cloudinary credentials are not fully defined. Image uploads will fail."
  );
}

// Cloudinary configuration initialized via environment variables.
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME || "",
  api_key: CLOUDINARY_API_KEY || "",
  api_secret: CLOUDINARY_API_SECRET || "",
}); 

// helpful util to debug signature issues
cloudinary.api.ping((err, result) => {
  if (err) {
    console.error("Cloudinary ping failed. Please verify credentials in your .env file.");
  }
});

function upload(file) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(file, { resource_type: "auto" }, (err, res) => {
      if (err) {
        console.log("cloudinary err:", err);
        // if signature failure, log system time for diagnosis
        if (err.message && err.message.includes("Invalid Signature")) {
          console.log("System time (ms):", Date.now());
        }
        reject(err);
      } else {
        resolve({
          public_id: res.public_id,
          secure_url: res.secure_url,
        });
      }
    });
  });
}

function deleteImage(publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (err, result) => {
      if (err) {
        console.log("cloudinary delete err:", err);
        reject(err);
      } else {
        console.log("cloudinary delete res:", result);
        resolve(result);
      }
    });
  });
}

module.exports = { upload, deleteImage };
