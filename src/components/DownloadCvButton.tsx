"use client";

import { downloadCvPdf } from "@/lib/cv-pdf-download";
import type { CvWithEntries } from "@/lib/types";

export default function DownloadCvButton({ data }: { data: CvWithEntries }) {
  return (
    <button
      type="button"
      onClick={() => void downloadCvPdf(data)}
      className="bg-[#1a2744] text-white px-4 py-2 text-sm hover:bg-[#243256] transition-colors"
    >
      Download PDF
    </button>
  );
}
