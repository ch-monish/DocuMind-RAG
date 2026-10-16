'use client';

import { useState } from 'react';
import DocumentSidebar from '@/components/DocumentSidebar';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import { Message, UploadedFile } from '@/types';

export default function Home() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Welcome! Upload a PDF on the left panel to index your document into Qdrant Cloud, then ask any question.',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // File Upload Handler (Calls FastAPI /api/upload)
  const handleFileUpload = async (file: File) => {
    const newFile: UploadedFile = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      status: 'processing',
    };

    setFiles((prev) => [...prev, newFile]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      setFiles((prev) =>
        prev.map((f) => (f.id === newFile.id ? { ...f, status: 'ready' } : f))
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) => (f.id === newFile.id ? { ...f, status: 'error' } : f))
      );
      alert('Failed to upload file to backend. Check console logs.');
    }
  };

  // Clear Knowledge Base Handler (Calls FastAPI /api/clear)
  const handleClearKB = async () => {
    if (!confirm('Are you sure you want to clear all indexed documents from Qdrant Cloud?')) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${backendUrl}/api/clear`, { method: 'POST' });
      if (res.ok) {
        setFiles([]);
        setMessages([
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Knowledge base cleared successfully. You can upload new documents.',
          },
        ]);
      }
    } catch {
      alert('Failed to clear knowledge base.');
    }
  };

  // Query Handler (Calls FastAPI /api/query)
  const handleSendMessage = async (queryText: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });

      if (!response.ok) throw new Error('Failed to query backend');

      const data = await response.json();

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        citations: data.citations,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error communicating with the cloud backend. Please ensure FastAPI is running.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      <DocumentSidebar 
        files={files} 
        onFileUpload={handleFileUpload} 
        onClearKB={handleClearKB} 
      />

      <section className="flex-1 flex flex-col justify-between h-full bg-slate-950/40">
        <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
          <h2 className="font-semibold text-sm text-slate-200">Cloud RAG Workspace</h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50">
            Connected to Qdrant & Groq
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>

        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </section>
    </main>
  );
}