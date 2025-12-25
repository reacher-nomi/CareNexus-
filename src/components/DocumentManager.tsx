import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:5000/api";

interface DocumentManagerProps {
  visitId: number;
  onClose: () => void;
}

interface Document {
  id: number;
  file_name: string;
  file_type: string;
  file_path: string;
  file_size: number;
  description: string;
  uploaded_at: string;
}

export default function DocumentManager({ visitId, onClose }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    loadDocuments();
  }, [visitId]);

  const loadDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/visits/${visitId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Error loading documents:", err);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("description", description);

    try {
      const response = await fetch(`${API_BASE}/visits/${visitId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        alert("Document uploaded successfully");
        setSelectedFile(null);
        setDescription("");
        loadDocuments();
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.error}`);
      }
    } catch (err) {
      console.error("Error uploading document:", err);
      alert("Error uploading document");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          padding: "30px",
          borderRadius: "8px",
          width: "600px",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Document Manager</h2>

        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ fontSize: "16px" }}>Upload New Document</h3>
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            style={{ marginBottom: "10px", display: "block" }}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: "10px",
              border: "1px solid #ccc",
            }}
          />
          <button onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        <div>
          <h3 style={{ fontSize: "16px" }}>Uploaded Documents ({documents.length})</h3>
          {documents.length === 0 ? (
            <p style={{ color: "#666" }}>No documents uploaded for this visit</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  style={{
                    padding: "10px",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong>{doc.file_name}</strong>
                    <br />
                    <small style={{ color: "#666" }}>
                      {doc.description || "No description"} • {doc.uploaded_at}
                    </small>
                  </div>
                  <a
                    href={`http://localhost:5000/${doc.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ alignSelf: "center" }}
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button onClick={onClose} style={{ marginTop: "20px" }}>
          Close
        </button>
      </div>
    </div>
  );
}
