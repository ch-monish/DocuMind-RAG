'use client';

import { useState } from 'react';
import { Message } from '@/types';

export default function ChatMessage({ message }: { message: Message }) {
  const [showCitations, setShowCitations] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm ${
        isUser
          ? 'bg-cyan-600 text-white rounded-br-xs'
          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-xs'
      }`}>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

        {/* Render Citation Accordeon for Assistant Responses */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-800 text-xs">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>{showCitations ? 'Hide' : 'View'} Grounded Sources ({message.citations.length})</span>
            </button>

            {showCitations && (
              <div className="mt-2 space-y-2">
                {message.citations.map((c, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-slate-950/80 border border-slate-800 text-slate-400">
                    <p className="font-semibold text-slate-300 text-[11px]">
                      📄 {c.documentName} {c.pageNumber ? `(Page ${c.pageNumber})` : ''}
                    </p>
                    <p className="italic text-[11px] mt-1 text-slate-400 border-l-2 border-cyan-500/50 pl-2">
                      "{c.textChunk}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}