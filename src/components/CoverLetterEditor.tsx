"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CoverLetter, CoverLetterWithCv, Cv } from "@/lib/types";
import { Input, RichTextarea } from "@/components/EditorFields";

export default function CoverLetterEditor({
  initialData,
  allCvs,
}: {
  initialData: CoverLetterWithCv;
  allCvs: Cv[];
}) {
  const [letter, setLetter] = useState(initialData.coverLetter);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveAll() {
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("cover_letters")
      .update({
        slug: letter.slug,
        role: letter.role,
        company_name: letter.company_name,
        body: letter.body,
        cv_id: letter.cv_id,
        is_public: letter.is_public,
      })
      .eq("id", letter.id);

    setSaving(false);
    setMessage(error ? error.message : "Saved.");
  }

  return (
    <div className="space-y-8">
      <section className="bg-white border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a2744]">Cover Letter Details</h2>

        <div className="grid md:grid-cols-3 gap-3">
          <Input
            label="Role"
            value={letter.role}
            onChange={(v) => setLetter((prev) => ({ ...prev, role: v }))}
          />
          <Input
            label="Company name"
            value={letter.company_name}
            onChange={(v) => setLetter((prev) => ({ ...prev, company_name: v }))}
          />
          <Input
            label="Slug"
            value={letter.slug}
            onChange={(v) => setLetter((prev) => ({ ...prev, slug: v }))}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Linked CV (for contact details in footer)</label>
          <select
            value={letter.cv_id ?? ""}
            onChange={(e) =>
              setLetter((prev) => ({ ...prev, cv_id: e.target.value ? Number(e.target.value) : null }))
            }
            className="w-full border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {allCvs.map((cv) => (
              <option key={cv.id} value={cv.id}>
                {cv.title} — {cv.full_name}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={letter.is_public}
            onChange={(e) => setLetter((prev) => ({ ...prev, is_public: e.target.checked }))}
          />
          Publicly visible
        </label>
      </section>

      <section className="bg-white border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a2744]">Letter Body</h2>

        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 px-4 py-3 space-y-1">
          <p>
            <span className="font-medium text-gray-700">Auto-generated header:</span>{" "}
            Dear {letter.company_name || "[Company name]"} Hiring Team,
          </p>
          <p className="text-xs text-gray-400">
            Write the full body below. The closing (Best regards, name, contact info) is auto-generated from the linked CV.
          </p>
        </div>

        <RichTextarea
          label="Body"
          value={letter.body ?? ""}
          onChange={(v) => setLetter((prev) => ({ ...prev, body: v }))}
          minHeightClassName="min-h-[400px]"
        />
      </section>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="bg-[#1a2744] text-white px-6 py-2 text-sm hover:bg-[#243256] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Cover Letter"}
        </button>
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
