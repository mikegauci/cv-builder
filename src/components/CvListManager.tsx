"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureUniqueSlug } from "@/lib/cv-pdf";
import { parseCvPdf } from "@/lib/cv-pdf-import";
import { DEFAULT_TIMELINE_NOTES } from "@/lib/generate-cv-defaults";
import { supabase } from "@/lib/supabase";
import type { Cv } from "@/lib/types";

interface Props {
  initialCvs: Cv[];
}

const slugPattern = /^[a-z0-9-]+$/;

export default function CvListManager({ initialCvs }: Props) {
  const [cvs, setCvs] = useState(initialCvs);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [message, setMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [generateMessage, setGenerateMessage] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [timelineNotes, setTimelineNotes] = useState(DEFAULT_TIMELINE_NOTES);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setCvs(initialCvs);
  }, [initialCvs]);

  async function createCv(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!slugPattern.test(slug)) {
      setMessage("Slug can only contain lowercase letters, numbers and dashes.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("cvs")
      .insert({
        title,
        slug,
        target_role: targetRole,
        full_name: "Your Name",
        summary: "",
        profile_image_url: "",
        city: "",
        country: "",
        linkedin: "",
        github: "",
      })
      .select("*")
      .single();

    if (error || !data) {
      setMessage(error?.message ?? "Could not create CV.");
      setLoading(false);
      return;
    }

    setCvs((prev) => [data as Cv, ...prev]);
    setTitle("");
    setSlug("");
    setTargetRole("");
    setLoading(false);
    router.push(`/admin/cvs/${data.id}`);
  }

  async function cloneCv(cv: Cv) {
    setLoading(true);
    setMessage("");

    const newSlug = `${cv.slug}-copy`;

    const { data: newCv, error: cvError } = await supabase
      .from("cvs")
      .insert({
        title: `${cv.title} (Copy)`,
        slug: newSlug,
        target_role: cv.target_role,
        full_name: cv.full_name,
        summary: cv.summary,
        profile_image_url: cv.profile_image_url,
        email: cv.email,
        phone: cv.phone,
        city: cv.city,
        country: cv.country,
        linkedin: cv.linkedin,
        github: cv.github,
        website: cv.website,
        is_public: cv.is_public,
      })
      .select("*")
      .single();

    if (cvError || !newCv) {
      setMessage(cvError?.message ?? "Could not clone CV.");
      setLoading(false);
      return;
    }

    const { data: entries } = await supabase
      .from("cv_entries")
      .select("*")
      .eq("cv_id", cv.id);

    if (entries && entries.length > 0) {
      const clonedEntries = entries.map(({ id: _id, cv_id: _cvId, ...rest }: { id: number; cv_id: number; [key: string]: unknown }) => ({
        ...rest,
        cv_id: newCv.id,
      }));

      const { error: entriesError } = await supabase.from("cv_entries").insert(clonedEntries);
      if (entriesError) {
        setMessage(entriesError.message);
        setLoading(false);
        return;
      }
    }

    setCvs((prev) => [newCv as Cv, ...prev]);
    setLoading(false);
    router.push(`/admin/cvs/${newCv.id}`);
  }

  async function generateCvFromJob(e: React.FormEvent) {
    e.preventDefault();
    setGenerateMessage("");
    setMessage("");
    setImportMessage("");

    if (!jobDescription.trim()) {
      setGenerateMessage("Paste a job description first.");
      return;
    }

    setGenerating(true);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/generate-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          companyName: companyName.trim(),
          timelineNotes: timelineNotes.trim(),
        }),
      });

      const payload = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !payload.id) {
        setGenerateMessage(payload.error ?? "Could not generate CV.");
        setGenerating(false);
        setLoading(false);
        return;
      }

      setJobDescription("");
      setCompanyName("");
      setTimelineNotes(DEFAULT_TIMELINE_NOTES);
      router.push(`/admin/cvs/${payload.id}`);
      router.refresh();
    } catch (error) {
      setGenerateMessage(error instanceof Error ? error.message : "Could not generate CV.");
      setGenerating(false);
      setLoading(false);
    }
  }

  async function deleteCv(cvId: number) {
    const confirmed = window.confirm("Delete this CV? This cannot be undone.");
    if (!confirmed) return;

    const { error } = await supabase.from("cvs").delete().eq("id", cvId);
    if (error) {
      setMessage(error.message);
      return;
    }

    setCvs((prev) => prev.filter((cv) => cv.id !== cvId));
  }

  async function importCvFromPdf(file: File) {
    setLoading(true);
    setImportMessage("");
    setMessage("");

    try {
      const parsed = await parseCvPdf(file);
      const existingSlugs = cvs.map((cv) => cv.slug);
      const uniqueSlug = ensureUniqueSlug(parsed.cv.slug, existingSlugs);

      const { data: newCv, error: cvError } = await supabase
        .from("cvs")
        .insert({
          title: parsed.cv.title,
          slug: uniqueSlug,
          target_role: parsed.cv.target_role,
          full_name: parsed.cv.full_name,
          summary: parsed.cv.summary,
          profile_image_url: parsed.cv.profile_image_url,
          email: parsed.cv.email,
          phone: parsed.cv.phone,
          city: parsed.cv.city,
          country: parsed.cv.country,
          linkedin: parsed.cv.linkedin,
          github: parsed.cv.github,
          website: parsed.cv.website,
          is_public: false,
        })
        .select("*")
        .single();

      if (cvError || !newCv) {
        setImportMessage(cvError?.message ?? "Could not create CV from PDF.");
        setLoading(false);
        return;
      }

      if (parsed.entries.length > 0) {
        const entriesToInsert = parsed.entries.map((entry) => ({
          ...entry,
          cv_id: newCv.id,
        }));

        const { error: entriesError } = await supabase.from("cv_entries").insert(entriesToInsert);
        if (entriesError) {
          await supabase.from("cvs").delete().eq("id", newCv.id);
          setImportMessage(entriesError.message);
          setLoading(false);
          return;
        }
      }

      setCvs((prev) => [newCv as Cv, ...prev]);
      setLoading(false);
      router.push(`/admin/cvs/${newCv.id}?imported=${parsed.source}`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Could not import PDF.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={createCv} className="bg-white border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a2744]">Create New CV</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
            placeholder="CV title"
            required
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
            placeholder="Slug (e.g. frontend-engineer)"
            required
          />
          <input
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
            placeholder="Target role"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-[#1a2744] text-white px-5 py-2 text-sm hover:bg-[#243256] disabled:opacity-50"
        >
          {loading && !generating ? "Creating..." : "Create CV"}
        </button>
        {message && <p className="text-xs text-red-500">{message}</p>}
      </form>

      <form onSubmit={generateCvFromJob} className="bg-white border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a2744]">Generate from job description</h2>
        <p className="text-xs text-gray-500">
          Paste a job posting. OpenAI will read all of your existing CVs and create a new unpublished
          draft tailored to that role. Review dates and wording in the editor before publishing.
        </p>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="w-full border border-gray-300 px-3 py-2 text-sm min-h-40"
          placeholder="Paste the full job description"
          required
        />
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full border border-gray-300 px-3 py-2 text-sm"
          placeholder="Company name (optional)"
        />
        <div>
          <label className="block text-xs text-gray-500 mb-1">Timeline notes</label>
          <textarea
            value={timelineNotes}
            onChange={(e) => setTimelineNotes(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-[#1a2744] text-white px-5 py-2 text-sm hover:bg-[#243256] disabled:opacity-50"
        >
          {generating ? "Generating... this can take a minute" : "Generate tailored CV"}
        </button>
        {generateMessage && <p className="text-xs text-red-500">{generateMessage}</p>}
      </form>

      <section className="bg-white border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a2744]">Import from PDF</h2>
        <p className="text-xs text-gray-500">
          Upload a PDF previously downloaded from cv-builder. Profile images are not included in PDFs.
          Layout-parsed imports may lose rich-text formatting such as bold or italic. Imported CVs start
          as drafts; enable Publicly visible in the editor to publish at /cv/your-slug.
        </p>
        <input
          ref={importInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void importCvFromPdf(file);
            }
          }}
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => importInputRef.current?.click()}
          className="border border-[#1a2744] text-[#1a2744] px-5 py-2 text-sm hover:bg-[#1a2744]/5 disabled:opacity-50"
        >
          {loading && !generating ? "Importing..." : "Choose PDF"}
        </button>
        {importMessage && <p className="text-xs text-red-500">{importMessage}</p>}
      </section>

      <div className="bg-white border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-[#1a2744]">Your CVs</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {cvs.length === 0 && <p className="px-6 py-6 text-sm text-gray-500">No CVs yet.</p>}
          {cvs.map((cv) => (
            <div key={cv.id} className="px-6 py-4 flex items-center gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1a2744]">{cv.title}</p>
                <p className="text-xs text-gray-500">{cv.target_role}</p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <a
                  href={cv.is_public ? `/cv/${cv.slug}` : `/admin/cvs/${cv.id}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
                >
                  {cv.is_public ? "View" : "Preview"}
                </a>
                <a
                  href={`/admin/cvs/${cv.id}`}
                  className="text-xs border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
                >
                  Edit
                </a>
                <button
                  type="button"
                  onClick={() => cloneCv(cv)}
                  disabled={loading}
                  className="text-xs border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                >
                  Clone
                </button>
                <button
                  type="button"
                  onClick={() => deleteCv(cv.id)}
                  className="text-xs text-red-500 border border-red-200 px-3 py-1.5 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
