import type { CvSectionType, CvWithEntries } from "@/lib/types";

export const CV_PDF_IMPORT_MARKER = "cvbuilder:v1:";

export const cvPdfSectionOrder: CvSectionType[] = [
  "experience",
  "education",
  "languages",
  "skills",
  "courses",
];

export const cvPdfKnownSections: CvSectionType[] = [
  ...cvPdfSectionOrder,
  "projects",
  "certifications",
];

export const cvPdfCompactSections: CvSectionType[] = ["languages", "skills"];
export const cvPdfNoDescriptionSections: CvSectionType[] = ["courses"];

export interface CvPdfImportEntry {
  section: CvSectionType;
  item_order: number;
  title: string;
  subtitle: string | null;
  date_label: string | null;
  description: string | null;
}

export interface CvPdfImportPayload {
  v: 1;
  cv: {
    full_name: string;
    target_role: string;
    summary: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
  };
  entries: CvPdfImportEntry[];
}

export function encodeCvPdfImportPayload(payload: CvPdfImportPayload): string {
  return CV_PDF_IMPORT_MARKER + base64UrlEncode(JSON.stringify(payload));
}

export function decodeCvPdfImportPayload(raw: string): CvPdfImportPayload | null {
  if (!raw.startsWith(CV_PDF_IMPORT_MARKER)) {
    return null;
  }

  try {
    const json = base64UrlDecode(raw.slice(CV_PDF_IMPORT_MARKER.length));
    const parsed = JSON.parse(json) as CvPdfImportPayload;
    if (parsed.v !== 1 || !parsed.cv || !Array.isArray(parsed.entries)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildCvPdfImportPayload(data: CvWithEntries): CvPdfImportPayload {
  return {
    v: 1,
    cv: {
      full_name: data.cv.full_name,
      target_role: data.cv.target_role,
      summary: data.cv.summary,
      email: data.cv.email,
      phone: data.cv.phone,
      city: data.cv.city,
      country: data.cv.country,
      linkedin: data.cv.linkedin,
      github: data.cv.github,
      website: data.cv.website,
    },
    entries: data.entries.map((entry) => ({
      section: entry.section,
      item_order: entry.item_order,
      title: entry.title,
      subtitle: entry.subtitle,
      date_label: entry.date_label,
      description: entry.description,
    })),
  };
}

export function deriveSlugFromFilename(filename: string): string | null {
  const baseName = filename.replace(/\.pdf$/i, "").trim();
  const lastDash = baseName.lastIndexOf("-");
  if (lastDash === -1) {
    return null;
  }

  const slug = baseName.slice(lastDash + 1).toLowerCase();
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

export function ensureUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let candidate = `${baseSlug}-imported`;
  let counter = 2;
  while (existingSlugs.includes(candidate)) {
    candidate = `${baseSlug}-imported-${counter}`;
    counter += 1;
  }
  return candidate;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
