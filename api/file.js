import formidable from "formidable";
import fs from "fs";
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

export const config = {
  api: {
    bodyParser: false, // disable default body parser for file upload
  },
};

const client = new S3Client({
  endpoint: "https://gateway.storjshare.io",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.STORJ_ACCESS_KEY,
    secretAccessKey: process.env.STORJ_SECRET_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ error: "File parsing failed", details: err.message });
      }

      const file = files.file; // name="file" from input
      const fileStream = fs.createReadStream(file.filepath);

      try {
        await client.send(
          new PutObjectCommand({
            Bucket: process.env.STORJ_BUCKET,
            Key: file.originalFilename,
            Body: fileStream,
          })
        );
        res.status(200).json({ message: "Upload successful", fileName: file.originalFilename });
      } catch (uploadErr) {
        res.status(500).json({ error: "Upload failed", details: uploadErr.message });
      }
    });
  } else if (req.method === "GET") {
    try {
      const result = await client.send(new ListObjectsV2Command({ Bucket: process.env.STORJ_BUCKET }));
      const files = result.Contents?.map((f) => f.Key) || [];
      res.status(200).json({ files });
    } catch (listErr) {
      res.status(500).json({ error: "List failed", details: listErr.message });
    }
  } else {
    res
