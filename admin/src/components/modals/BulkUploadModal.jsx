import React, { useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { motion } from "framer-motion";
import { X, UploadCloud, Send, Loader } from "lucide-react";
import { createBulkMembers } from "../../../config/apis";

const BulkUploadModal = ({ onClose, onUpload }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedData, setParsedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = (e) => {
    setError("");
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split(".").pop().toLowerCase();
    setFile(selectedFile);

    const parseData = (data) => {
      if (!data.length) {
        setError("Uploaded file is empty or invalid!");
        return;
      }
      setParsedData(data);
      setPreview(data.slice(0, 10)); // show preview
      setHeaders(Object.keys(data[0] || {}));
    };

    if (ext === "csv") {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => parseData(results.data),
        error: () => setError("Failed to parse CSV file!"),
      });
    } else if (["xlsx", "xls"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const workbook = XLSX.read(evt.target.result, { type: "binary" });
          const ws = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws);
          parseData(data);
        } catch {
          setError("Failed to read Excel file!");
        }
      };
      reader.readAsBinaryString(selectedFile);
    } else {
      setError("Please upload a CSV or Excel file only!");
    }
  };

  const handleUpload = async () => {
    setError("");
    if (!parsedData.length) {
      setError("No data to upload!");
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    const chunkSize = 500;
    const totalChunks = Math.ceil(parsedData.length / chunkSize);
    let uploadedChunks = 0;

    // Helper: Upload one chunk
    const uploadChunk = async (chunk) => {
      try {
        const res = await onUpload(chunk);
        if (!res.status == 201) {
          const errMsg = await res.text().catch(() => "Unknown error");
          throw new Error(errMsg || `HTTP ${res.status}`);
        }
        return true;
      } catch (err) {
        throw new Error(err.message || "Network error");
      }
    };

    // Process chunks sequentially
    for (let i = 0; i < parsedData.length; i += chunkSize) {
      const chunk = parsedData.slice(i, i + chunkSize);

      try {
        await uploadChunk(chunk); // Wait for 200 OK

        uploadedChunks++;
        const progress = Math.round((uploadedChunks / totalChunks) * 100);
        setUploadProgress(progress);

        // Optional: small delay to avoid rate-limiting
        // await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error("Chunk upload failed:", err);
        setError(
          `Failed at chunk ${uploadedChunks + 1}/${totalChunks}: ${err.message}`
        );
        setLoading(false);
        return; // Stop on first failure
      }
    }

    // All chunks uploaded
    setLoading(false);
    setUploadProgress(100);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-primary-dark w-full max-w-3xl rounded-2xl border border-amber-400/50 shadow-xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-amber-400/40 p-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UploadCloud className="text-amber-400" size={20} />
            Bulk Upload Members
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-amber-400/20 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Box */}
        {error && (
          <div className="bg-red-600/80 text-white p-3 m-4 rounded-lg">
            {error}
          </div>
        )}

        {/* File Drop Area */}
        <div className="p-6 text-center border-dashed border-2 border-amber-400/50 rounded-xl m-4 hover:border-amber-400 transition">
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFile}
            className="hidden"
            id="fileInput"
          />
          <label htmlFor="fileInput" className="cursor-pointer text-amber-400">
            {file ? (
              <span className="font-semibold">{file.name}</span>
            ) : (
              <>
                <UploadCloud className="inline-block mb-2 text-amber-400" />
                <p className="text-sm">Click or drop a CSV/XLSX file here</p>
              </>
            )}
          </label>
        </div>

        {preview.length > 0 && (
          <>
            <div className="max-h-[400px] overflow-auto p-6">
              <table className="w-full text-base text-left border border-amber-400/40 text-white rounded-lg">
                <thead className="bg-gray-600 sticky top-0">
                  <tr>
                    {headers.map((h, idx) => (
                      <th
                        key={idx}
                        className="px-4 py-2 border border-amber-400/30 font-semibold tracking-wide text-white uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr
                      key={i}
                      className="odd:bg-white/5 even:bg-transparent hover:bg-amber-400/10 transition"
                    >
                      {headers.map((h, idx) => (
                        <td
                          key={idx}
                          className="px-6 py-3 border border-amber-400/10 text-white/90 whitespace-nowrap"
                        >
                          {row[h] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {uploadProgress > 0 && (
              <div className="absolute bottom-20 left-0 w-full bg-gray-700 h-2 rounded-full">
                <div
                  className="bg-amber-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-x-3 border-t border-amber-400/20 p-5 items-center">
          {loading && (
            <div className="flex items-center gap-2 text-white">
              <Loader className="animate-spin" size={18} />
              Uploading...
            </div>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-sm"
            disabled={loading}
          >
            Cancel
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleUpload}
            disabled={!file || loading}
            className={`flex items-center gap-1 px-5 py-2 rounded-full text-sm font-semibold ${
              file && !loading
                ? "bg-amber-400 hover:bg-amber-500 text-gray-950"
                : "bg-gray-600 text-gray-300 cursor-not-allowed"
            }`}
          >
            <Send size={14} />
            Upload
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default BulkUploadModal;
