import formidable from "formidable";
import fs from "fs";
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Disable Next.js body parser (we’re using formidable for file uploads)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Storj S3 Client
const client = new S3Client({
  endpoint: "https://gateway.storjshare.io",
  region: "us-east-1", // dummy, required by SDK
  credentials: {
    accessKeyId: process.env.STORJ_ACCESS_KEY,
    secretAccessKey: process.env.STORJ_SECRET_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    // ✅ File upload
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ error: "File parsing failed", details: err.message });
      }

      const file = files.file;
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
    const { action, filename } = req.query;

    if (action === "list") {
      // ✅ List files
      try {
        const result = await client.send(
          new ListObjectsV2Command({ Bucket: process.env.STORJ_BUCKET })
        );

        const files =
          result.Contents?.map((f) => ({
            name: f.Key,
            url: `https://gateway.storjshare.io/${process.env.STORJ_BUCKET}/${f.Key}`,
          })) || [];

        return res.status(200).json({ files });
      } catch (listErr) {
        return res.status(500).json({
          error: "List failed",
          details: listErr.message,
        });
      }
    } else if (action === "download" && filename) {
      // ✅ Generate presigned download link
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.STORJ_BUCKET,
          Key: filename,
        });

        const url = await getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hour

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
}
