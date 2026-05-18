'use client';

import { useCallback, useState, useRef } from 'react';

interface FileUploadProps {
  onUpload: (csv: string, fileName: string) => void;
  currentFile?: string;
}

export function FileUpload({ onUpload, currentFile }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onUpload(text, file.name);
      };
      reader.readAsText(file);
    },
    [onUpload]
  );

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
        dragging
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div className="flex flex-col items-center gap-3">
        <svg
          className="w-10 h-10 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        {currentFile ? (
          <div>
            <p className="text-zinc-300 font-medium">{currentFile}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Drop a new CSV to replace, or click to browse
            </p>
          </div>
        ) : (
          <div>
            <p className="text-zinc-300 font-medium">
              Drop your Marketwind CSV here
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Supports raw exports and validated/audited CSVs
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
