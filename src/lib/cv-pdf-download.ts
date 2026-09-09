import {
  buildCvPdfFilename,
  buildCvPdfImportPayload,
  cvPdfCompactSections,
  cvPdfNoDescriptionSections,
  cvPdfSectionOrder,
  encodeCvPdfImportPayload,
} from "@/lib/cv-pdf";
import type { CvEntry, CvSectionType, CvWithEntries } from "@/lib/types";

function splitBySection(entries: CvEntry[]) {
  return entries.reduce<Record<string, CvEntry[]>>((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {});
}

const sectionOrder = cvPdfSectionOrder;
const compactSections = cvPdfCompactSections;
const noDescriptionSections = cvPdfNoDescriptionSections;
const PAGE_TOP = 52;
const PAGE_BOTTOM = 790;
const COLOR_PRIMARY: [number, number, number] = [26, 39, 68]; // #1a2744
const COLOR_GRAY_500: [number, number, number] = [107, 114, 128]; // #6b7280
const COLOR_GRAY_600: [number, number, number] = [75, 85, 99]; // #4b5563
const COLOR_GRAY_700: [number, number, number] = [55, 65, 81]; // #374151

type RichToken = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

type HeaderItem = {
  label: string;
  icon: "email" | "phone" | "location" | "linkedin" | "github" | "portfolio";
  url?: string;
};

function toPlainText(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/\*(.*?)\*/g, "$1");
}

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function iconPath(icon: HeaderItem["icon"]) {
  if (icon === "email") {
    return "M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25V6.75Zm2.2-.25L12 11.22l6.8-4.72H5.2Zm13.3 2.22-5.94 4.13a1 1 0 0 1-1.12 0L5.5 8.72v8.53c0 .41.34.75.75.75h11.5c.41 0 .75-.34.75-.75V8.72Z";
  }
  if (icon === "phone") {
    return "M6.62 2.67a1 1 0 0 1 1.07-.24l3.1 1.03a1 1 0 0 1 .66.86l.2 2.6a1 1 0 0 1-.29.8L9.66 9.4a13.11 13.11 0 0 0 4.94 4.94l1.68-1.7a1 1 0 0 1 .8-.28l2.6.2a1 1 0 0 1 .86.66l1.03 3.1a1 1 0 0 1-.24 1.07l-1.4 1.4a3 3 0 0 1-3.12.72c-2.95-1-5.72-2.87-8.24-5.38-2.51-2.52-4.38-5.29-5.38-8.24a3 3 0 0 1 .72-3.12l1.4-1.4Z";
  }
  if (icon === "location") {
    return "M12 2a7 7 0 0 0-7 7c0 4.85 5.46 11.56 6.08 12.3a1.2 1.2 0 0 0 1.84 0C13.54 20.56 19 13.85 19 9a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z";
  }
  if (icon === "linkedin") {
    return "M6.94 8.5H3.56V20h3.38V8.5Zm-1.69-1.9a1.97 1.97 0 1 0 0-3.94 1.97 1.97 0 0 0 0 3.94ZM20.44 20h-3.38v-5.62c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97V20H9.66V8.5h3.24v1.57h.05c.45-.86 1.55-1.77 3.19-1.77 3.42 0 4.05 2.25 4.05 5.17V20Z";
  }
  if (icon === "github") {
    return "M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.71c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.54 2.35 1.1 2.92.84.09-.65.35-1.1.63-1.36-2.22-.26-4.56-1.11-4.56-4.95 0-1.1.39-2 1.03-2.7-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.03A9.54 9.54 0 0 1 12 6.84c.85 0 1.7.12 2.5.35 1.91-1.3 2.75-1.03 2.75-1.03.55 1.4.2 2.45.1 2.71.64.7 1.03 1.6 1.03 2.7 0 3.85-2.34 4.69-4.58 4.94.36.31.68.91.68 1.84v2.73c0 .27.18.58.69.48A10 10 0 0 0 12 2Z";
  }
  return "M4 5.75A1.75 1.75 0 0 1 5.75 4h12.5A1.75 1.75 0 0 1 20 5.75v8.5A1.75 1.75 0 0 1 18.25 16h-4.93l.53 2H16a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h2.15l.53-2H5.75A1.75 1.75 0 0 1 4 14.25v-8.5ZM6 6v8h12V6H6Z";
}

function parseRichTokens(line: string): RichToken[] {
  const tokens: RichToken[] = [];
  let index = 0;

  while (index < line.length) {
    if (line.startsWith("**", index)) {
      const end = line.indexOf("**", index + 2);
      if (end !== -1) {
        tokens.push({ text: line.slice(index + 2, end), bold: true, italic: false, underline: false });
        index = end + 2;
        continue;
      }
    }

    if (line.startsWith("__", index)) {
      const end = line.indexOf("__", index + 2);
      if (end !== -1) {
        tokens.push({ text: line.slice(index + 2, end), bold: false, italic: false, underline: true });
        index = end + 2;
        continue;
      }
    }

    if (line.startsWith("*", index)) {
      const end = line.indexOf("*", index + 1);
      if (end !== -1) {
        tokens.push({ text: line.slice(index + 1, end), bold: false, italic: true, underline: false });
        index = end + 1;
        continue;
      }
    }

    let next = line.length;
    const nextBold = line.indexOf("**", index);
    const nextUnderline = line.indexOf("__", index);
    const nextItalic = line.indexOf("*", index);

    if (nextBold !== -1) next = Math.min(next, nextBold);
    if (nextUnderline !== -1) next = Math.min(next, nextUnderline);
    if (nextItalic !== -1) next = Math.min(next, nextItalic);

    tokens.push({ text: line.slice(index, next), bold: false, italic: false, underline: false });
    index = next;
  }

  return tokens.filter((token) => token.text.length > 0);
}

export async function downloadCvPdf(data: CvWithEntries): Promise<void> {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const sections = splitBySection(data.entries);
    const location = [data.cv.city, data.cv.country].filter(Boolean).join(", ");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const left = 48;
    const right = pageWidth - 48;
    const contentWidth = right - left;
    let y = PAGE_TOP;
    const iconCache = new Map<string, string>();

    async function iconData(icon: HeaderItem["icon"]) {
      const key = `${icon}-${COLOR_GRAY_500.join("-")}`;
      if (iconCache.has(key)) return iconCache.get(key) as string;

      const [r, g, b] = COLOR_GRAY_500;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgb(${r},${g},${b})"><path d="${iconPath(icon)}"/></svg>`;
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = svgUrl;
      });

      const size = 24;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      ctx.drawImage(image, 0, 0, size, size);
      const png = canvas.toDataURL("image/png");
      iconCache.set(key, png);
      return png;
    }

    function ensurePage(extraHeight = 0) {
      if (y + extraHeight > PAGE_BOTTOM) {
        pdf.addPage();
        y = PAGE_TOP;
      }
    }

    function textWidth(text: string, token: RichToken, fontSize: number) {
      const style = token.bold && token.italic ? "bolditalic" : token.bold ? "bold" : token.italic ? "italic" : "normal";
      pdf.setFont("helvetica", style);
      pdf.setFontSize(fontSize);
      return pdf.getTextWidth(text);
    }

    function drawRichLine(tokens: RichToken[], x: number, lineY: number, fontSize: number, color: [number, number, number]) {
      let cursorX = x;

      for (const token of tokens) {
        const style = token.bold && token.italic ? "bolditalic" : token.bold ? "bold" : token.italic ? "italic" : "normal";
        pdf.setFont("helvetica", style);
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...color);
        pdf.text(token.text, cursorX, lineY);
        const width = pdf.getTextWidth(token.text);

        if (token.underline && token.text.trim().length > 0) {
          pdf.setLineWidth(0.5);
          pdf.line(cursorX, lineY + 1.5, cursorX + width, lineY + 1.5);
        }

        cursorX += width;
      }
    }

    function drawRichTextBlock(
      text: string,
      x: number,
      maxWidth: number,
      fontSize: number,
      lineHeight: number,
      color: [number, number, number]
    ) {
      const lines = text.split(/\r?\n/);

      for (const rawLine of lines) {
        const normalizedLine = rawLine.replace(/^- /, "\u2022 ");
        const parsedTokens = parseRichTokens(normalizedLine);

        if (parsedTokens.length === 0) {
          ensurePage(lineHeight);
          y += lineHeight;
          continue;
        }

        const segments = parsedTokens.flatMap((token) =>
          token.text
            .split(/(\s+)/)
            .filter((part) => part.length > 0)
            .map((part) => ({ ...token, text: part }))
        );

        let lineTokens: RichToken[] = [];
        let lineWidth = 0;

        for (const segment of segments) {
          const segmentWidth = textWidth(segment.text, segment, fontSize);
          const exceeds = lineWidth + segmentWidth > maxWidth;
          const isWhitespaceOnly = /^\s+$/.test(segment.text);

          if (exceeds && lineTokens.length > 0 && !isWhitespaceOnly) {
            ensurePage(lineHeight);
            drawRichLine(lineTokens, x, y, fontSize, color);
            y += lineHeight;
            lineTokens = [];
            lineWidth = 0;
          }

          if (!(lineTokens.length === 0 && isWhitespaceOnly)) {
            lineTokens.push(segment);
            lineWidth += segmentWidth;
          }
        }

        if (lineTokens.length > 0) {
          ensurePage(lineHeight);
          drawRichLine(lineTokens, x, y, fontSize, color);
          y += lineHeight;
        }
      }
    }

    function drawBulletList(text: string, x: number, maxWidth: number, fontSize: number, lineHeight: number) {
      const rows = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (const row of rows) {
        const clean = row.replace(/^[-•]\s*/, "");
        const wrapped = pdf.splitTextToSize(`\u2022 ${toPlainText(clean)}`, maxWidth);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...COLOR_GRAY_700);
        ensurePage(wrapped.length * lineHeight + 2);
        pdf.text(wrapped, x, y);
        y += wrapped.length * lineHeight + 3;
      }
    }

    function looksLikeBulletList(text: string) {
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) return false;
      const bulletLike = lines.filter((line) => /^[-•]\s+/.test(line)).length;
      return bulletLike >= Math.max(1, Math.floor(lines.length * 0.5));
    }

    async function drawHeaderItems(items: HeaderItem[], x: number, lineY: number) {
      if (items.length === 0) return;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...COLOR_GRAY_500);
      let cursorX = x;
      const iconSize = 10;

      for (const item of items) {
        const icon = await iconData(item.icon);
        if (icon) {
          pdf.addImage(icon, "PNG", cursorX, lineY - iconSize + 1, iconSize, iconSize);
        }
        cursorX += iconSize + 4;

        const labelWidth = pdf.getTextWidth(item.label);
        if (item.url) {
          pdf.textWithLink(item.label, cursorX, lineY, { url: normalizeUrl(item.url) });
        } else {
          pdf.text(item.label, cursorX, lineY);
        }
        cursorX += labelWidth + 12;
      }
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(32);
    pdf.setTextColor(...COLOR_PRIMARY);
    pdf.text(data.cv.full_name, left, y);
    y += 26;

    if (data.cv.target_role) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(14);
      pdf.setTextColor(...COLOR_GRAY_600);
      pdf.text(data.cv.target_role, left, y);
      y += 18;
    }

    const allHeaderItems: HeaderItem[] = [
      data.cv.email ? { icon: "email", label: data.cv.email } : null,
      data.cv.phone ? { icon: "phone", label: data.cv.phone } : null,
      location ? { icon: "location", label: location } : null,
      data.cv.linkedin ? { icon: "linkedin", label: "LinkedIn", url: data.cv.linkedin } : null,
      data.cv.github ? { icon: "github", label: "GitHub", url: data.cv.github } : null,
      data.cv.website ? { icon: "portfolio", label: "Portfolio", url: data.cv.website } : null,
    ].filter(Boolean) as HeaderItem[];

    if (allHeaderItems.length > 0) {
      await drawHeaderItems(allHeaderItems, left, y);
      y += 18;
    }

    if (data.cv.summary) {
      drawRichTextBlock(data.cv.summary, left, contentWidth, 11.5, 16, COLOR_GRAY_700);
      y += 2;
    }

    const orderedSections = [
      ...sectionOrder.filter((section) => sections[section]?.length),
      ...Object.keys(sections).filter((section) => !sectionOrder.includes(section as CvSectionType)),
    ];

    for (const sectionName of orderedSections) {
      const items = sections[sectionName];
      ensurePage(36);
      pdf.setDrawColor(210, 214, 220);
      pdf.setLineWidth(0.8);
      pdf.line(left, y, right, y);
      y += 26;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.setTextColor(...COLOR_GRAY_500);
      pdf.text(sectionName.toUpperCase(), left, y);
      y += 20;

      if (sectionName === "languages") {
        const line = items.map((item) => (item.subtitle ? `${item.title} (${item.subtitle})` : item.title)).join(" | ");
        const wrapped = pdf.splitTextToSize(line, contentWidth);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11.5);
        pdf.setTextColor(...COLOR_GRAY_700);
        pdf.text(wrapped, left, y);
        y += wrapped.length * 10 + 8;
        continue;
      }

      if (sectionName === "skills") {
        for (const item of items) {
          ensurePage(16);
          const richLine = `\u2022 **${item.title}:** ${item.description || item.subtitle || ""}`;
          drawRichTextBlock(richLine, left, contentWidth, 11, 13, COLOR_GRAY_700);
          y += 4;
        }
        y += 8;
        continue;
      }

      for (const item of items) {
        ensurePage(34);

        const dateText = compactSections.includes(sectionName as CvSectionType) ? "" : item.date_label ?? "";
        const titleMaxWidth = dateText ? contentWidth - 170 : contentWidth;
        const titleLines = pdf.splitTextToSize(item.title, titleMaxWidth);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(...COLOR_PRIMARY);
        pdf.text(titleLines, left, y);

        if (dateText) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
          pdf.setTextColor(...COLOR_GRAY_500);
          pdf.text(dateText, right, y, { align: "right" });
        }
        y += titleLines.length * 14;

        if (item.subtitle) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
          pdf.setTextColor(...COLOR_GRAY_600);
          const subtitleLines = pdf.splitTextToSize(item.subtitle, contentWidth);
          pdf.text(subtitleLines, left, y);
          y += subtitleLines.length * 13 + 3;
        }

        if (item.description && !noDescriptionSections.includes(sectionName as CvSectionType)) {
          if (looksLikeBulletList(item.description)) {
            // Add breathing room between company line and first bullet.
            y += 5;
            drawBulletList(item.description, left, contentWidth, 10.5, 13);
            // Add spacing before next role block starts.
            y += 6;
          } else {
            drawRichTextBlock(item.description, left, contentWidth, 10.5, 13, COLOR_GRAY_700);
            y += 2;
          }
          y += 6;
        } else {
          y += 10;
        }
      }

      y += 2;
    }

    pdf.setProperties({
      creator: "cv-builder",
      keywords: encodeCvPdfImportPayload(buildCvPdfImportPayload(data)),
    });

  pdf.save(buildCvPdfFilename(data.cv.full_name, data.cv.slug));
}
