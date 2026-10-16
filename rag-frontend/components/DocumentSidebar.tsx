'use client';

import { useState, useEffect } from 'react';
import { UploadedFile, StorageStats } from '@/types';

interface DocumentSidebarProps {
  files: UploadedFile[];
  onFileUpload: (file: File) => void;
  onClearKB: () => void;
}

export default function DocumentSidebar({ files, onFileUpload, onClearKB }: DocumentSidebarProps) {
  const [dragActive, setDragActive] = useState(false);
  const [stats, setStats] = useState<StorageStats | null>(null);

  // Fetch real-time storage stats from backend
  const fetchStats = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${backendUrl}/api/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Fallback if backend is offline
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [files]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          <h1 className="text-xl font-bold text-slate-100">Cloud RAG Engine</h1>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Upload PDF documents to ground your AI assistant in secure cloud vector storage.
        </p>

        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-5 text-center transition bg-slate-950/40 ${
            dragActive ? 'border-cyan-400 bg-cyan-950/20' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <svg className="w-8 h-8 mx-auto text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs font-medium text-slate-300">Drag & drop your PDF here</p>
          <p className="text-[10px] text-slate-500 mt-1">Supports PDF files</p>

          <input type="file" accept=".pdf" id="pdf-upload" onChange={handleFileChange} className="hidden" />
          <label
            htmlFor="pdf-upload"
            className="mt-3 inline-block text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition"
          >
            Select PDF
          </label>
        </div>

        {/* Real-time Storage Monitor Widget */}
        <div className="mt-6 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
          <div className="flex justify-between items-center mb-1.5 font-semibold text-slate-300">
            <span>☁️ Qdrant Cloud Storage</span>
            <span className="text-[10px] text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded">Free Tier</span>
          </div>
          {stats ? (
            <div className="space-y-1 text-slate-400 text-[11px]">
              <div className="flex justify-between">
                <span>Memory Used:</span>
                <span className="text-slate-200">{stats.estimated_memory_used}</span>
              </div>
              <div className="flex justify-between">
                <span>Chunks Indexed:</span>
                <span className="text-slate-200">{stats.total_chunks_indexed}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.max(parseFloat(stats.usage_percentage), 1)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">Loading cluster stats...</p>
          )}
        </div>

        {/* Loaded Documents List */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Files ({files.length})
            </h2>
            {files.length > 0 && (
              <button
                onClick={onClearKB}
                className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
              >
                Clear Database
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No files indexed yet.</p>
            ) : (
              files.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
                  <span className="truncate max-w-[150px] text-slate-300">{f.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    f.status === 'ready' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' :
                    f.status === 'processing' ? 'bg-amber-950 text-amber-400 border border-amber-800/50 animate-pulse' :
                    'bg-rose-950 text-rose-400 border border-rose-800/50'
                  }`}>
                    {f.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="text-[11px] text-slate-600 pt-4 border-t border-slate-800">
        Next.js • FastAPI • Groq • Qdrant Cloud
      </div>
    </aside>
  );
}