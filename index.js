import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [uploaded, setUploaded] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  const handleUpload = async () => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result.split(",")[1];

      const res = await fetch("YOUR_LAMBDA_URL/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          file: base64,
        }),
      });

      const data = await res.json();
      setUploaded(data.message);
    };
    reader.readAsDataURL(file);
  };

  const getDownload = async () => {
    const res = await fetch(`YOUR_LAMBDA_URL/file?filename=${file.name}`);
    const data = await res.json();
    setDownloadUrl(data.url);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 space-y-4">
      <h1 className="text-2xl font-bold">Storj File Uploader</h1>

      <input
        type="file"
        onChange={(e) => setFile(e.target.files[0])}
        className="border p-2 rounded"
      />

      <button
        onClick={handleUpload}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Upload
      </button>

      {uploaded && <p>{uploaded}</p>}

      <button
        onClick={getDownload}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        Get Download Link
      </button>

      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          Download File
        </a>
      )}
    </div>
  );
}
