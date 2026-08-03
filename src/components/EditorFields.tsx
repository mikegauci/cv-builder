"use client";

import { useEffect, useRef } from "react";

export function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

export function RichTextarea({
  label,
  value,
  onChange,
  minHeightClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeightClassName: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  type Snapshot = { value: string; start: number; end: number };
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (pendingSelection.current && textareaRef.current) {
      const { start, end } = pendingSelection.current;
      textareaRef.current.setSelectionRange(start, end);
      pendingSelection.current = null;
    }
  });

  function snapshot() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    redoStack.current = [];
    undoStack.current.push({
      value: textarea.value,
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  }

  function applyList() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    snapshot();
    textarea.focus();

    const currentValue = textarea.value;
    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? currentValue.length;

    const lineStart = currentValue.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = currentValue.indexOf("\n", end);
    const blockEnd = lineEnd === -1 ? currentValue.length : lineEnd;

    const block = currentValue.slice(lineStart, blockEnd);
    const lines = block.split("\n");
    const allBullets = lines.every((l) => l.startsWith("- "));

    const replaced = lines
      .map((l) => (allBullets ? l.slice(2) : l.startsWith("- ") ? l : `- ${l}`))
      .join("\n");

    textarea.setRangeText(replaced, lineStart, blockEnd, "preserve");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const normalised = text
      .split("\n")
      .map((line) => line.replace(/^[\s]*[•·▪▸➤\-–—*]\s+/, "- "))
      .join("\n");

    if (normalised === text) return;

    e.preventDefault();
    snapshot();

    const textarea = textareaRef.current!;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(normalised, start, end, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function applyMarker(marker: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    snapshot();
    textarea.focus();

    const currentValue = textarea.value;
    const markerSize = marker.length;
    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? currentValue.length;
    const selectedText = currentValue.slice(start, end);

    let replaceStart = start;
    let replaceEnd = end;
    let replacement = `${marker}${selectedText}${marker}`;
    let nextStart = start + markerSize;
    let nextEnd = nextStart + selectedText.length;

    const isSelectionSelfWrapped =
      selectedText.startsWith(marker) &&
      selectedText.endsWith(marker) &&
      selectedText.length >= markerSize * 2;
    const isSelectionWrappedByNeighbors =
      start >= markerSize &&
      currentValue.slice(start - markerSize, start) === marker &&
      currentValue.slice(end, end + markerSize) === marker;

    if (isSelectionSelfWrapped) {
      replacement = selectedText.slice(markerSize, selectedText.length - markerSize);
      nextStart = start;
      nextEnd = start + replacement.length;
    } else if (isSelectionWrappedByNeighbors) {
      replaceStart = start - markerSize;
      replaceEnd = end + markerSize;
      replacement = selectedText;
      nextStart = replaceStart;
      nextEnd = replaceStart + replacement.length;
    }

    textarea.setRangeText(replacement, replaceStart, replaceEnd, "preserve");
    textarea.setSelectionRange(nextStart, nextEnd);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!e.metaKey && !e.ctrlKey) return;

    const key = e.key.toLowerCase();

    if (key === "z") {
      const stack = e.shiftKey ? redoStack : undoStack;
      const counterStack = e.shiftKey ? undoStack : redoStack;
      const state = stack.current.pop();
      if (state) {
        e.preventDefault();
        const textarea = textareaRef.current!;
        counterStack.current.push({
          value: textarea.value,
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
        });
        pendingSelection.current = { start: state.start, end: state.end };
        onChange(state.value);
      }
      return;
    }

    const shortcuts: Record<string, () => void> = {
      b: () => applyMarker("**"),
      i: () => applyMarker("*"),
      u: () => applyMarker("__"),
      l: () => applyList(),
    };

    const handler = shortcuts[key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs text-gray-500">{label}</label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyMarker("**")}
            className="text-xs border border-gray-300 px-2 py-0.5 hover:bg-gray-50 font-bold"
            aria-label="Bold (⌘B)"
            title="Bold (⌘B)"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyMarker("*")}
            className="text-xs border border-gray-300 px-2 py-0.5 hover:bg-gray-50 italic"
            aria-label="Italic (⌘I)"
            title="Italic (⌘I)"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyMarker("__")}
            className="text-xs border border-gray-300 px-2 py-0.5 hover:bg-gray-50 underline"
            aria-label="Underline (⌘U)"
            title="Underline (⌘U)"
          >
            U
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyList}
            className="text-xs border border-gray-300 px-2 py-0.5 hover:bg-gray-50"
            aria-label="List (⌘L)"
            title="List (⌘L)"
          >
            • List
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`w-full border border-gray-300 px-3 py-2 text-sm ${minHeightClassName}`}
      />
      <p className="text-xs text-gray-500 mt-1">
        ⌘B bold · ⌘I italic · ⌘U underline · ⌘L list · Enter for new line.
      </p>
    </div>
  );
}
