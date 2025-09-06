"use client";

import { useState } from "react";

interface ReplyCardProps {
  text: string;
  index: number;
}

export default function ReplyCard({ text, index }: ReplyCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-200">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm mr-3">
            {index + 1}
          </div>
          <span className="font-semibold text-gray-900">Option {index + 1}</span>
        </div>
        <div className="relative">
          <button
            onClick={handleCopy}
            disabled={copied}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-75"
          >
            <span>📋</span>
            <span>{copied ? "Copied!" : "Copy to Clipboard"}</span>
          </button>
          {copied && (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-lg animate-pulse">
              ✓ Copied!
            </div>
          )}
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-800 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
