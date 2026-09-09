import type { CoverLetter, Cv } from "@/lib/types";

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function buildCoverLetterPlainText(coverLetter: CoverLetter, cv: Cv | null): string {
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

export function splitCoverLetterParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
