import formidable from "formidable";
import fs from "fs";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

// Disable Next.js body parser (we’re using formidable instead)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Storj S3 Client
const client = new S3Client({
  endpoint: "https://gateway.storjshare.io",
  region: "us-east-1", // required, can be anything
  credentials: {
    accessKeyId: process.env.STORJ_ACCESS_KEY,
    secretAccessKey: process.env.STORJ_SECRET_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    // Handle file upload
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ error: "File parsing failed", details: err.message });
      }

      const file = files.file; // must match <input type="file" name="file" />
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      try {
        const fileStream = fs.createReadStream(file.filepath);

        await client.send(
          new PutObjectCommand({
            Bucket: process.env.STORJ_BUCKET,
            Key: file.originalFilename,
            Body: fileStream,
          })
        );

        return res.status(200).json({
          message: "Upload successful",
          fileName: file.originalFilename,
        });
      } catch (uploadErr) {
        return res.status(500).json({
          error: "Upload failed",
          details: uploadErr.message,
        });
      }
    });
  } else if (req.method === "GET") {
    // Handle listing files
    try {
      const result = await client.send(
        new ListObjectsV2Command({ Bucket: process.env.STORJ_BUCKET })
      );

      const files = result.Contents?.map((f) => f.Key) || [];
      return res.status(200).json({ files });
    } catch (listErr) {
      return res.status(500).json({
        error: "List failed",
        details: listErr.message,
      });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
