"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { CoverLetter, Cv } from "@/lib/types";

const slugPattern = /^[a-z0-9-]+$/;

interface Props {
  initialCoverLetters: CoverLetter[];
  allCvs: Cv[];
}

export default function CoverLetterListManager({ initialCoverLetters, allCvs }: Props) {
  const [coverLetters, setCoverLetters] = useState(initialCoverLetters);
  const [role, setRole] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [cvId, setCvId] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function createCoverLetter(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!slugPattern.test(slug)) {
      setMessage("Slug can only contain lowercase letters, numbers and dashes.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("cover_letters")
      .insert({
        role,
        company_name: companyName,
        slug,
        cv_id: cvId || null,
        body: "",
        is_public: false,
      })
      .select("*")
      .single();

    if (error || !data) {
      setMessage(error?.message ?? "Could not create cover letter.");
      setLoading(false);
      return;
    }

    setCoverLetters((prev) => [data as CoverLetter, ...prev]);
    setRole("");
    setCompanyName("");
    setSlug("");
    setCvId("");
    setLoading(false);
    router.push(`/admin/cover-letters/${data.id}`);
  }

  async function deleteCoverLetter(id: number) {
    const confirmed = window.confirm("Delete this cover letter? This cannot be undone.");
    if (!confirmed) return;

    const { error } = await supabase.from("cover_letters").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }

    setCoverLetters((prev) => prev.filter((cl) => cl.id !== id));
  }

  function cvName(cvId: number | null) {
    if (!cvId) return null;
    const cv = allCvs.find((c) => c.id === cvId);
    return cv ? cv.title : null;
  }

  return (
    <div className="space-y-8">
      <form onSubmit={createCoverLetter} className="bg-white border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a2744]">Create New Cover Letter</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
            placeholder="Role (e.g. Senior Frontend Engineer)"
            required
          />
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
            placeholder="Company name (e.g. Acme Corp)"
            required
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
            placeholder="Slug (e.g. acme-corp-engineer)"
            required
          />
          <select
            value={cvId}
            onChange={(e) => setCvId(e.target.value ? Number(e.target.value) : "")}
            className="border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Link to CV (optional)</option>
            {allCvs.map((cv) => (
              <option key={cv.id} value={cv.id}>
                {cv.title} — {cv.full_name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-[#1a2744] text-white px-5 py-2 text-sm hover:bg-[#243256] disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Cover Letter"}
        </button>
        {message && <p className="text-xs text-red-500">{message}</p>}
      </form>

      <div className="bg-white border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-[#1a2744]">Your Cover Letters</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {coverLetters.length === 0 && (
            <p className="px-6 py-6 text-sm text-gray-500">No cover letters yet.</p>
          )}
          {coverLetters.map((cl) => (
            <div key={cl.id} className="px-6 py-4 flex items-center gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1a2744]">{cl.company_name}</p>
                <p className="text-xs text-gray-500">
                  {cl.role}
                  {cvName(cl.cv_id) && <span className="ml-2 text-gray-400">· {cvName(cl.cv_id)}</span>}
                </p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <a
                  href={`/cover-letter/${cl.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
                >
                  View
                </a>
                <a
                  href={`/admin/cover-letters/${cl.id}`}
                  className="text-xs border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
                >
                  Edit
                </a>
                <button
                  type="button"
                  onClick={() => deleteCoverLetter(cl.id)}
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
