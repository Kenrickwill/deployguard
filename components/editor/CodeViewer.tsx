"use client";

import dynamic from "next/dynamic";

// Monaco is large — load it client-side only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface CodeViewerProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  height?: string;
  onChange?: (value: string | undefined) => void;
}

export function CodeViewer({
  value,
  language = "typescript",
  readOnly = true,
  height = "400px",
  onChange,
}: CodeViewerProps) {
  return (
    <div className="rounded-md overflow-hidden border">
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 12 },
        }}
        onChange={onChange}
      />
    </div>
  );
}
