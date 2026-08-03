"use client";

import { useState } from "react";
import type { CoverLetter, Cv } from "@/lib/types";

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function buildPlainText(coverLetter: CoverLetter, cv: Cv | null): string {
  const lines: string[] = [];

  lines.push(`Dear ${coverLetter.company_name} Hiring Team,`);
  lines.push("");

  if (coverLetter.body) {
    lines.push(coverLetter.body.trim());
    lines.push("");
  }

  lines.push("Best regards,");

  if (cv) {
    lines.push(cv.full_name);
    if (cv.phone) lines.push(cv.phone);
    if (cv.email) lines.push(cv.email);
    if (cv.linkedin) lines.push(normalizeUrl(cv.linkedin));
    if (cv.website) lines.push(normalizeUrl(cv.website));
  }

  return lines.join("\n");
}

export default function CopyCoverLetterButton({
  coverLetter,
  cv,
}: {
  coverLetter: CoverLetter;
  cv: Cv | null;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = buildPlainText(coverLetter, cv);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 bg-[#1a2744] text-white text-xs px-4 py-2 hover:bg-[#243256] transition-colors"
    >
      {copied ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
            <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
          </svg>
          Copy Letter
        </>
      )}
    </button>
  );
}
