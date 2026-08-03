import {
  cvPdfCompactSections,
  cvPdfKnownSections,
  cvPdfNoDescriptionSections,
  decodeCvPdfImportPayload,
  deriveSlugFromFilename,
  type CvPdfImportPayload,
} from "@/lib/cv-pdf";
import type { CvEntry, CvSectionType } from "@/lib/types";

export type ParsedCvImport = {
  cv: {
    title: string;
    slug: string;
    target_role: string;
    summary: string | null;
    full_name: string;
    profile_image_url: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
    is_public: boolean;
  };
  entries: Omit<CvEntry, "id" | "cv_id">[];
  source: "metadata" | "layout";
};

type TextItem = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
};

type TextLine = {
  y: number;
  page: number;
  items: TextItem[];
  text: string;
  bold: boolean;
  fontSize: number;
};

type LinkAnnotation = {
  label: string;
  url: string;
};

const LINE_Y_TOLERANCE = 3;
const RIGHT_DATE_X = 380;
const SECTION_NAMES = new Set(cvPdfKnownSections.map((section) => section.toUpperCase()));

let workerConfigured = false;

async function getPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured && typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

export async function parseCvPdf(file: File): Promise<ParsedCvImport> {
  const pdfjs = await getPdfJs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes }).promise;

  const metadata = await doc.getMetadata();
  const info = metadata?.info as Record<string, unknown> | null | undefined;
  const keywords = info?.Keywords;
  if (typeof keywords === "string") {
    const payload = decodeCvPdfImportPayload(keywords);
    if (payload) {
      return buildFromPayload(payload, file.name, "metadata");
    }
  }

  const lines: TextLine[] = [];
  const links: LinkAnnotation[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageItems: TextItem[] = textContent.items
      .map((item) => {
        if (!("str" in item) || !item.str.trim()) {
          return null;
        }

        const transform = item.transform;
        const fontName = "fontName" in item && typeof item.fontName === "string" ? item.fontName : "";
        return {
          text: item.str,
          x: transform[4],
          y: transform[5],
          fontSize: Math.max(Math.abs(transform[0]), Math.abs(transform[3])),
          bold: /bold/i.test(fontName),
        };
      })
      .filter((item): item is TextItem => item !== null);

    lines.push(...groupItemsIntoLines(pageItems, pageNumber));

    const annotations = await page.getAnnotations();
    for (const annotation of annotations) {
      if (annotation.subtype !== "Link" || !annotation.url) {
        continue;
      }

      const rect = annotation.rect;
      if (!rect) {
        continue;
      }

      const label = findLabelNearRect(pageItems, rect) ?? annotation.url;
      links.push({ label, url: annotation.url });
    }
  }

  lines.sort((a, b) => {
    if (a.page !== b.page) {
      return a.page - b.page;
    }
    return b.y - a.y;
  });

  const parsed = parseLayoutLines(lines, links);
  if (!parsed) {
    throw new Error("Could not parse this PDF. Only CVs exported from cv-builder are supported.");
  }

  const slug = deriveSlugFromFilename(file.name) ?? slugify(parsed.cv.target_role || parsed.cv.full_name);
  return {
    ...parsed,
    cv: {
      ...parsed.cv,
      slug,
      title: parsed.cv.target_role || `${parsed.cv.full_name} CV`,
      profile_image_url: null,
      is_public: false,
    },
    source: "layout",
  };
}

function buildFromPayload(payload: CvPdfImportPayload, filename: string, source: "metadata"): ParsedCvImport {
  const slug = deriveSlugFromFilename(filename) ?? slugify(payload.cv.target_role || payload.cv.full_name);

  return {
    cv: {
      title: payload.cv.target_role || `${payload.cv.full_name} CV`,
      slug,
      target_role: payload.cv.target_role,
      summary: payload.cv.summary,
      full_name: payload.cv.full_name,
      profile_image_url: null,
      email: payload.cv.email,
      phone: payload.cv.phone,
      city: payload.cv.city,
      country: payload.cv.country,
      linkedin: payload.cv.linkedin,
      github: payload.cv.github,
      website: payload.cv.website,
      is_public: false,
    },
    entries: payload.entries,
    source,
  };
}

function groupItemsIntoLines(items: TextItem[], page: number): TextLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextLine[] = [];

  for (const item of sorted) {
    const existing = lines.find((line) => line.page === page && Math.abs(line.y - item.y) <= LINE_Y_TOLERANCE);
    if (existing) {
      existing.items.push(item);
      existing.text = mergeLineText(existing.items);
      existing.bold = existing.items.some((entry) => entry.bold);
      existing.fontSize = Math.max(existing.fontSize, item.fontSize);
      continue;
    }

    lines.push({
      page,
      y: item.y,
      items: [item],
      text: item.text,
      bold: item.bold,
      fontSize: item.fontSize,
    });
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = mergeLineText(line.items);
  }

  return lines;
}

function mergeLineText(items: TextItem[]): string {
  return items
    .map((item) => item.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLayoutLines(lines: TextLine[], links: LinkAnnotation[]): ParsedCvImport | null {
  const sectionIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => SECTION_NAMES.has(line.text.trim().toUpperCase()));

  if (sectionIndexes.length === 0 && lines.length === 0) {
    return null;
  }

  const firstSectionIndex = sectionIndexes[0]?.index ?? lines.length;
  const headerLines = lines.slice(0, firstSectionIndex);
  const header = parseHeader(headerLines, links);
  if (!header.full_name) {
    return null;
  }

  const entries: Omit<CvEntry, "id" | "cv_id">[] = [];

  for (let i = 0; i < sectionIndexes.length; i += 1) {
    const { line: sectionLine, index: startIndex } = sectionIndexes[i];
    const endIndex = sectionIndexes[i + 1]?.index ?? lines.length;
    const sectionName = sectionLine.text.trim().toLowerCase() as CvSectionType;
    const sectionLines = lines.slice(startIndex + 1, endIndex).filter((line) => line.text.length > 0);
    entries.push(...parseSectionEntries(sectionName, sectionLines));
  }

  return {
    cv: {
      title: "",
      slug: "",
      target_role: header.target_role,
      summary: header.summary,
      full_name: header.full_name,
      profile_image_url: null,
      email: header.email,
      phone: header.phone,
      city: header.city,
      country: header.country,
      linkedin: header.linkedin,
      github: header.github,
      website: header.website,
      is_public: false,
    },
    entries,
    source: "layout",
  };
}

function parseHeader(lines: TextLine[], links: LinkAnnotation[]) {
  const remaining = [...lines];
  const fullNameLine = remaining.shift();
  const full_name = fullNameLine?.text.trim() ?? "";

  let target_role = "";
  if (remaining[0] && !looksLikeContactLine(remaining[0]) && remaining[0].fontSize <= 16) {
    target_role = remaining.shift()?.text.trim() ?? "";
  }

  const contactLines: TextLine[] = [];
  while (remaining[0] && looksLikeContactLine(remaining[0])) {
    contactLines.push(remaining.shift() as TextLine);
  }

  const contactText = contactLines.map((line) => line.text).join(" ");
  const email = extractEmail(contactText);
  const phone = extractPhone(contactText);

  const linkedin = findLinkUrl(links, ["linkedin"]) ?? "";
  const github = findLinkUrl(links, ["github"]) ?? "";
  const website = findLinkUrl(links, ["portfolio", "website"]) ?? "";

  const locationText = contactText
    .replace(email ?? "", "")
    .replace(phone ?? "", "")
    .replace(/\bLinkedIn\b/gi, "")
    .replace(/\bGitHub\b/gi, "")
    .replace(/\bPortfolio\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^,|,$/g, "")
    .trim();

  const { city, country } = splitLocation(locationText);
  const summary = remaining
    .map((line) => line.text)
    .join("\n")
    .trim();

  return {
    full_name,
    target_role,
    summary: summary || null,
    email: email || null,
    phone: phone || null,
    city,
    country,
    linkedin: linkedin || null,
    github: github || null,
    website: website || null,
  };
}

function parseSectionEntries(section: CvSectionType, lines: TextLine[]): Omit<CvEntry, "id" | "cv_id">[] {
  if (section === "languages") {
    const text = lines.map((line) => line.text).join(" ");
    const parts = text
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.map((part, index) => {
      const match = part.match(/^(.*?)(?:\s*\((.+)\))?$/);
      return {
        section,
        item_order: index + 1,
        title: match?.[1]?.trim() || part,
        subtitle: match?.[2]?.trim() || null,
        date_label: null,
        description: null,
      };
    });
  }

  if (section === "skills") {
    return lines
      .map((line) => line.text.trim())
      .filter((text) => text.length > 0)
      .map((text, index) => {
        const cleaned = text.replace(/^[•\-]\s*/, "");
        const match = cleaned.match(/^(.*?):\s*(.+)$/);
        return {
          section,
          item_order: index + 1,
          title: match?.[1]?.trim() || cleaned,
          subtitle: null,
          date_label: null,
          description: match?.[2]?.trim() || null,
        };
      });
  }

  const entries: Omit<CvEntry, "id" | "cv_id">[] = [];
  let current: Omit<CvEntry, "id" | "cv_id"> | null = null;
  let descriptionLines: string[] = [];

  function flushCurrent() {
    if (!current) {
      return;
    }

    if (!cvPdfNoDescriptionSections.includes(section) && descriptionLines.length > 0) {
      current.description = descriptionLines.join("\n").trim();
    }

    entries.push(current);
    current = null;
    descriptionLines = [];
  }

  for (const line of lines) {
    const isEntryTitle = line.bold || line.fontSize >= 11.5;

    if (isEntryTitle && !line.text.startsWith("•")) {
      flushCurrent();
      const { title, date_label } = splitTitleAndDate(line);
      current = {
        section,
        item_order: entries.length + 1,
        title,
        subtitle: null,
        date_label: cvPdfCompactSections.includes(section) ? null : date_label,
        description: null,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (!current.subtitle && line.fontSize >= 10.5 && line.fontSize <= 11.5 && !line.text.startsWith("•")) {
      current.subtitle = line.text.trim();
      continue;
    }

    if (!cvPdfNoDescriptionSections.includes(section)) {
      descriptionLines.push(line.text.trim());
    }
  }

  flushCurrent();
  return entries;
}

function splitTitleAndDate(line: TextLine): { title: string; date_label: string | null } {
  const leftItems = line.items.filter((item) => item.x < RIGHT_DATE_X);
  const rightItems = line.items.filter((item) => item.x >= RIGHT_DATE_X);

  const title = mergeLineText(leftItems.length > 0 ? leftItems : line.items);
  const date_label = rightItems.length > 0 ? mergeLineText(rightItems) : null;
  return { title, date_label };
}

function looksLikeContactLine(line: TextLine): boolean {
  const text = line.text;
  return (
    /@/.test(text) ||
    /\bLinkedIn\b/i.test(text) ||
    /\bGitHub\b/i.test(text) ||
    /\bPortfolio\b/i.test(text) ||
    /\+?\d[\d\s().-]{6,}\d/.test(text)
  );
}

function extractEmail(text: string): string | null {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/\+?\d[\d\s().-]{6,}\d/);
  return match?.[0]?.trim() ?? null;
}

function splitLocation(locationText: string): { city: string | null; country: string | null } {
  if (!locationText) {
    return { city: null, country: null };
  }

  const parts = locationText.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], country: parts.slice(1).join(", ") };
  }

  return { city: locationText, country: null };
}

function findLinkUrl(links: LinkAnnotation[], labels: string[]): string | null {
  const match = links.find((link) => labels.some((label) => link.label.toLowerCase().includes(label)));
  return match?.url ?? null;
}

function findLabelNearRect(items: TextItem[], rect: number[]): string | null {
  const [x1, y1, x2, y2] = rect;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  const nearby = items.find(
    (item) => Math.abs(item.x - centerX) < 80 && Math.abs(item.y - centerY) < 12,
  );

  return nearby?.text.trim() ?? null;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "imported-cv";
}
