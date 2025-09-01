import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileName, fileContent } = req.body;

    if (!fileName || !fileContent) {
      return res.status(400).json({ error: "fileName and fileContent required" });
    }

    // Connect to Storj S3 gateway
    const s3 = new S3Client({
      region: "us-east-1", // dummy, Storj ignores this
      endpoint: process.env.STORJ_S3_ENDPOINT, // e.g. https://gateway.storjshare.io
      credentials: {
        accessKeyId: process.env.STORJ_ACCESS_KEY,
        secretAccessKey: process.env.STORJ_SECRET_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: process.env.STORJ_BUCKET,
      Key: fileName,
      Body: Buffer.from(fileContent, "base64"), // frontend should send base64
    });

    await s3.send(command);

    return res.status(200).json({ message: "File uploaded successfully" });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
}

