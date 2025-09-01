import formidable from "formidable";
import fs from "fs";
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  console.log('=== API/FILE Handler Started ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  try {
    // Add CORS headers first
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS request');
      return res.status(200).end();
    }

    // Check environment variables
    const envCheck = {
      hasKey: !!process.env.STORJ_KEY,
      hasSecret: !!process.env.STORJ_SECRET,
      hasBucket: !!process.env.STORJ_BUCKET,
      keyLength: process.env.STORJ_KEY?.length,
    };
    console.log('Environment check:', envCheck);

    if (!process.env.STORJ_KEY || !process.env.STORJ_SECRET || !process.env.STORJ_BUCKET) {
      console.error('Missing environment variables');
      return res.status(500).json({ 
        error: 'Missing environment variables',
        envCheck: envCheck
      });
    }

    // Initialize S3 client
    console.log('Initializing S3 client...');
    const client = new S3Client({
      endpoint: "https://gateway.storjshare.io",
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.STORJ_KEY,
        secretAccessKey: process.env.STORJ_SECRET,
      },
    });
    console.log('S3 client initialized successfully');

    if (req.method === "POST") {
      console.log('Processing file upload...');
      
      const form = formidable({ multiples: false });
      
      form.parse(req, async (err, fields, files) => {
        console.log('Form parse callback - START');
        
        if (err) {
          console.error('Formidable parsing error:', err);
          return res.status(500).json({ error: "File parsing failed", details: err.message });
        }

        console.log('Files object:', files);
        console.log('Fields object:', fields);
        
        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        
        if (!file) {
          console.error('No file found in upload');
          console.log('Available keys in files:', Object.keys(files));
          return res.status(400).json({ error: "No file uploaded" });
        }

        console.log('File details:', {
          name: file.originalFilename || file.name,
          size: file.size,
          type: file.mimetype,
          path: file.filepath
        });

        try {
          console.log('Creating file stream...');
          const fileStream = fs.createReadStream(file.filepath);
          const fileName = file.originalFilename || file.name;
          
          console.log('Sending to S3...');
          const uploadResult = await client.send(
            new PutObjectCommand({
              Bucket: process.env.STORJ_BUCKET,
              Key: fileName,
              Body: fileStream,
            })
          );
          
          console.log('Upload successful:', uploadResult);
          
          return res.status(200).json({
            message: "Upload successful",
            fileName: fileName,
          });
        } catch (uploadErr) {
          console.error('Upload error details:', {
            message: uploadErr.message,
            code: uploadErr.code,
            statusCode: uploadErr.$metadata?.httpStatusCode
          });
          return res.status(500).json({
            error: "Upload failed",
            details: uploadErr.message,
          });
        }
      });
      
    } else if (req.method === "GET") {
      console.log('Processing GET request');
      const { action, filename } = req.query;
      
      if (action === "list") {
        try {
          const result = await client.send(
            new ListObjectsV2Command({ Bucket: process.env.STORJ_BUCKET })
          );
          const files = result.Contents?.map((f) => ({
            name: f.Key,
            url: `https://gateway.storjshare.io/${process.env.STORJ_BUCKET}/${f.Key}`,
          })) || [];
          return res.status(200).json({ files });
        } catch (listErr) {
          console.error('List error:', listErr);
          return res.status(500).json({
            error: "List failed",
            details: listErr.message,
          });
        }
      } else if (action === "download" && filename) {
        try {
          const command = new GetObjectCommand({
            Bucket: process.env.STORJ_BUCKET,
            Key: filename,
          });
          const url = await getSignedUrl(client, command, { expiresIn: 3600 });
          return res.status(200).json({ downloadUrl: url });
        } catch (err) {
          console.error('Download error:', err);
          return res.status(500).json({
            error: "Download failed",
            details: err.message,
          });
        }
      } else {
        return res.status(400).json({ error: "Invalid action or missing filename" });
      }
    } else {
      console.log('Method not allowed:', req.method);
      return res.status(405).json({ error: "Method not allowed" });
    }
    
  } catch (globalError) {
    console.error('=== GLOBAL ERROR ===');
    console.error('Error message:', globalError.message);
    console.error('Error stack:', globalError.stack);
    console.error('Error details:', globalError);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: globalError.message,
      timestamp: new Date().toISOString()
    });
  }
}
