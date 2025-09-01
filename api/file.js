import formidable from "formidable";
import fs from "fs";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";  // ✅ This is the key import
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const config = {
  api: {
    bodyParser: false,
  },
};

const client = new S3Client({
  endpoint: "https://gateway.storjshare.io",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.STORJ_KEY,
    secretAccessKey: process.env.STORJ_SECRET,
  },
  forcePathStyle: true,
});

export default async function handler(req, res) {
  console.log('=== API/FILE Handler Started ===');
  
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (!process.env.STORJ_KEY || !process.env.STORJ_SECRET || !process.env.STORJ_BUCKET) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }

    if (req.method === "POST") {
      const form = formidable({ multiples: false });
      
      form.parse(req, async (err, fields, files) => {
        if (err) {
          return res.status(500).json({ error: "File parsing failed", details: err.message });
        }

        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        
        if (!file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        try {
          const fileName = file.originalFilename || file.name;
          const filePath = file.filepath;
          const fileBuffer = fs.readFileSync(filePath);
          
          console.log('Using AWS Upload class - bypasses Content-Length entirely');
          
          // ✅ This Upload class handles Content-Length automatically
          const upload = new Upload({
            client,
            params: {
              Bucket: "my-app-files",
              Key: fileName,
              Body: fileBuffer,
              ContentType: file.mimetype || 'application/octet-stream',
            }
          });
          
          const result = await upload.done();
          console.log('Upload successful:', result.Location);
          
          return res.status(200).json({
            message: "Upload successful",
            fileName: fileName,
            size: fileBuffer.length,
            location: result.Location
          });
        } catch (uploadErr) {
          console.error('Upload error:', uploadErr);
          return res.status(500).json({
            error: "Upload failed",
            details: uploadErr.message,
          });
        }
      });
      
    } else if (req.method === "GET") {
      const { action, filename } = req.query;
      
      if (action === "list") {
        try {
          const result = await client.send(
            new ListObjectsV2Command({ Bucket: "my-app-files" })
          );
          const files = result.Contents?.map((f) => ({
            name: f.Key,
          
          })) || [];
          return res.status(200).json({ files });
        } catch (listErr) {
          return res.status(500).json({
            error: "List failed",
            details: listErr.message,
          });
        }
      } else if (action === "download" && filename) {
        try {
          const command = new GetObjectCommand({
            Bucket: "my-app-files",
            Key: filename,
          });
          const url = await getSignedUrl(client, command, { expiresIn: 3600 });
          return res.status(200).json({ downloadUrl: url });
        } catch (err) {
          return res.status(500).json({
            error: "Download failed",
            details: err.message,
          });
        }
      } else {
        return res.status(400).json({ error: "Invalid action or missing filename" });
      }
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
    
  } catch (globalError) {
    console.error('Global error:', globalError);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: globalError.message
    });
  }
}
