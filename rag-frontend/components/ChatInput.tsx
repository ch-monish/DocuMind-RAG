'use client';

import { useState } from 'react';

interface ChatInputProps {
  onSendMessage: (query: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 bg-slate-900/40 flex gap-3">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={isLoading ? 'Generating answer with retrieved context...' : 'Ask a question about your documents...'}
        disabled={isLoading}
        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-5 py-3 rounded-xl text-sm font-semibold transition cursor-pointer"
      >
        {isLoading ? 'Searching...' : 'Send'}
      </button>
    </form>
  );
}