"use client";

/**
 * Shared drag-and-drop file zone used across every tool.
 *
 * Fixes the long-standing drag-and-drop problems: a robust enter/leave counter
 * (so the active state doesn't flicker over child elements), a visible
 * highlight while dragging, and a `copy` drop effect. Pair with <DropGuard /> in
 * the root layout so a file dropped *outside* a zone never makes the browser
 * navigate away.
 *
 * Use the <Dropzone> component for the standard dashed box, or the
 * `useFileDrop` hook to add the same behaviour to a custom container.
 */

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { ACCEPT_ANY_DOC } from "@/lib/limits";

type FilesHandler = (files: FileList | null) => void;

export function useFileDrop(onFiles: FilesHandler, disabled = false) {
  const [dragActive, setDragActive] = useState(false);
  const depth = useRef(0);

  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      depth.current += 1;
      setDragActive(true);
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (!disabled && e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: DragEvent) => {
      e.preventDefault();
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragActive(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setDragActive(false);
      if (disabled) return;
      onFiles(e.dataTransfer?.files ?? null);
    },
  };

  return { dragActive, dropHandlers };
}

export default function Dropzone({
  onFiles,
  accept = ACCEPT_ANY_DOC,
  multiple = false,
  disabled = false,
  className = "",
  children,
}: {
  onFiles: FilesHandler;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  /** Receives a function that opens the file picker and the current drag state. */
  children: (open: () => void, dragActive: boolean) => ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { dragActive, dropHandlers } = useFileDrop(onFiles, disabled);
  const open = () => inputRef.current?.click();

  return (
    <div
      {...dropHandlers}
      className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragActive ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        disabled={disabled}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = ""; // allow re-picking the same file
        }}
      />
      {children(open, dragActive)}
    </div>
  );
}
