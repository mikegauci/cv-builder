import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { jsPDF } from "jspdf";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const CV_PDF_IMPORT_MARKER = "cvbuilder:v1:";

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

const samplePayload = {
  v: 1,
  cv: {
    full_name: "Jane Doe",
    target_role: "Frontend Engineer",
    summary: "Builder of polished UIs.",
    email: "jane@example.com",
    phone: "+1 555 0100",
    city: "Valletta",
    country: "Malta",
    linkedin: "https://linkedin.com/in/janedoe",
    github: "https://github.com/janedoe",
    website: "https://janedoe.dev",
  },
  entries: [
    {
      section: "experience",
      item_order: 1,
      title: "Senior Engineer",
      subtitle: "Acme Corp",
      date_label: "2022 - Present",
      description: "- Built design systems\n- Led frontend guild",
    },
    {
      section: "languages",
      item_order: 1,
      title: "English",
      subtitle: "Native",
      date_label: null,
      description: null,
    },
  ],
};

const keywords = CV_PDF_IMPORT_MARKER + base64UrlEncode(JSON.stringify(samplePayload));

const pdf = new jsPDF({ unit: "pt", format: "a4" });
pdf.setFont("helvetica", "bold");
pdf.setFontSize(32);
pdf.text(samplePayload.cv.full_name, 48, 52);
pdf.setFont("helvetica", "normal");
pdf.setFontSize(14);
pdf.text(samplePayload.cv.target_role, 48, 78);
pdf.setFontSize(10.5);
pdf.text(`${samplePayload.cv.email} ${samplePayload.cv.phone} Valletta, Malta LinkedIn GitHub Portfolio`, 48, 96);
pdf.setFontSize(11.5);
pdf.text(samplePayload.cv.summary, 48, 120);
pdf.setFont("helvetica", "bold");
pdf.setFontSize(15);
pdf.text("EXPERIENCE", 48, 150);
pdf.setFontSize(12);
pdf.text("Senior Engineer", 48, 170);
pdf.text("2022 - Present", 420, 170, { align: "right" });
pdf.setFont("helvetica", "normal");
pdf.setFontSize(11);
pdf.text("Acme Corp", 48, 186);
pdf.text("- Built design systems", 48, 202);
pdf.text("- Led frontend guild", 48, 216);
pdf.setFont("helvetica", "bold");
pdf.setFontSize(15);
pdf.text("LANGUAGES", 48, 250);
pdf.setFont("helvetica", "normal");
pdf.setFontSize(11.5);
pdf.text("English (Native)", 48, 270);
pdf.setProperties({ creator: "cv-builder", keywords });

const pdfPath = join(root, "tmp-verify-cv.pdf");
const pdfBytes = Buffer.from(pdf.output("arraybuffer"));
writeFileSync(pdfPath, pdfBytes);

const doc = await getDocument({ data: new Uint8Array(pdfBytes) }).promise;
const metadata = await doc.getMetadata();
const decoded = base64UrlDecode(String(metadata.info.Keywords).slice(CV_PDF_IMPORT_MARKER.length));
const parsed = JSON.parse(decoded);

if (parsed.cv.full_name !== samplePayload.cv.full_name) {
  throw new Error("Metadata round-trip failed for full_name");
}

if (parsed.entries.length !== samplePayload.entries.length) {
  throw new Error("Metadata round-trip failed for entries length");
}

const page = await doc.getPage(1);
const textContent = await page.getTextContent();
const text = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");

if (!text.includes("Jane Doe") || !text.includes("EXPERIENCE") || !text.includes("English (Native)")) {
  throw new Error("Layout text extraction failed");
}

console.log("verify-cv-pdf-import: metadata round-trip OK");
console.log("verify-cv-pdf-import: layout text extraction OK");
console.log(`verify-cv-pdf-import: sample PDF written to ${pdfPath}`);
