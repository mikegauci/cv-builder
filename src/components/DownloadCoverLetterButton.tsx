"use client";

import { buildCoverLetterPlainText } from "@/lib/cover-letter-plain-text";
import type { CoverLetter, Cv } from "@/lib/types";

export default function DownloadCoverLetterButton({
  coverLetter,
  cv,
}: {
  coverLetter: CoverLetter;
  cv: Cv | null;
}) {
  async function handleDownload() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });

    const left = 56;
    const right = pdf.internal.pageSize.getWidth() - 56;
    const maxWidth = right - left;
    const pageBottom = 790;
    let y = 72;

    const plainText = buildCoverLetterPlainText(coverLetter, cv);
    const paragraphs = plainText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11.5);
    pdf.setTextColor(55, 65, 81);

    for (const paragraph of paragraphs) {
      const lines = paragraph.split("\n");
      for (const line of lines) {
        const wrapped = pdf.splitTextToSize(line, maxWidth);
        for (const wrappedLine of wrapped) {
          if (y > pageBottom) {
            pdf.addPage();
            y = 72;
          }
          pdf.text(wrappedLine, left, y);
          y += 16;
        }
      }
      y += 8;
    }

    const slugPart = coverLetter.slug.trim() || "cover-letter";
    const namePart = cv?.full_name.trim().replace(/\s+/g, "-") ?? "cover-letter";
    pdf.save(`${namePart}-${slugPart}.pdf`);
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownload()}
      className="inline-flex items-center gap-2 bg-[#1a2744] text-white text-xs px-4 py-2 hover:bg-[#243256] transition-colors"
    >
      Download PDF
    </button>
  );
}
