"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Cv, CvEntry, CvSectionType, CvWithEntries, JdCoverageItem } from "@/lib/types";
import { Input, RichTextarea } from "@/components/EditorFields";

type EditableEntry = Omit<CvEntry, "id"> & { id: number | null };

const slugPattern = /^[a-z0-9-]+$/;

const sections: CvSectionType[] = ["experience", "education", "languages", "skills", "courses"];
const compactSections: CvSectionType[] = ["languages", "skills"];
const skillsSection: CvSectionType = "skills";
const noDescriptionSections: CvSectionType[] = ["courses"];

function toEditableEntries(entries: CvEntry[]): EditableEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

export default function CvEditor({
  initialData,
  importSource,
}: {
  initialData: CvWithEntries;
  importSource?: "metadata" | "layout";
}) {
  const [cv, setCv] = useState(initialData.cv);
  const [savedIsPublic, setSavedIsPublic] = useState(initialData.cv.is_public);
  const [entries, setEntries] = useState<EditableEntry[]>(toEditableEntries(initialData.entries));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(true);
  const router = useRouter();

  const sortedEntryRefs = useMemo(
    () =>
      entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
          if (a.entry.section === b.entry.section) {
            return a.entry.item_order - b.entry.item_order;
          }
          return a.entry.section.localeCompare(b.entry.section);
        }),
    [entries]
  );

  function updateEntry(index: number, key: keyof EditableEntry, value: string | number) {
    setEntries((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  }

  function addEntry(section: CvSectionType) {
    const sectionEntries = entries.filter((entry) => entry.section === section);
    const nextOrder = sectionEntries.length + 1;
    setEntries((prev) => [
      ...prev,
      {
        id: null,
        cv_id: cv.id,
        section,
        item_order: nextOrder,
        title: "",
        subtitle: "",
        date_label: "",
        description: "",
      },
    ]);
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadProfileImage(file: File) {
    setUploadingImage(true);
    setMessage("");

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `cv-${cv.id}-${Date.now()}.${ext}`;
    const filePath = `${cv.slug}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from("cv-profile-images").upload(filePath, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

    if (uploadError) {
      setUploadingImage(false);
      setMessage(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("cv-profile-images").getPublicUrl(filePath);
    setCv((prev) => ({ ...prev, profile_image_url: data.publicUrl }));
    setUploadingImage(false);
    setMessage("Image uploaded. Save CV to persist it.");
  }

  async function saveAll() {
    setSaving(true);
    setMessage("");

    if (!slugPattern.test(cv.slug)) {
      setSaving(false);
      setMessage("Slug can only contain lowercase letters, numbers and dashes.");
      return;
    }

    const { data: updatedCv, error: cvError } = await supabase
      .from("cvs")
      .update({
        title: cv.title,
        slug: cv.slug,
        target_role: cv.target_role,
        summary: cv.summary,
        full_name: cv.full_name,
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
      .eq("id", cv.id)
      .select("*")
      .single();

    if (cvError || !updatedCv) {
      setSaving(false);
      setMessage(cvError?.message ?? "Could not save CV.");
      return;
    }

    setCv(updatedCv as Cv);
    setSavedIsPublic(updatedCv.is_public);

    const cleanedEntries = entries
      .filter((entry) => entry.title.trim().length > 0)
      .map((entry) => ({
        cv_id: cv.id,
        section: entry.section,
        item_order: entry.item_order,
        title: entry.title,
        subtitle: entry.subtitle?.trim() || null,
        date_label: compactSections.includes(entry.section) ? null : entry.date_label?.trim() || null,
        description: noDescriptionSections.includes(entry.section) ? null : entry.description?.trim() || null,
      }));

    const { error: deleteError } = await supabase.from("cv_entries").delete().eq("cv_id", cv.id);
    if (deleteError) {
      setSaving(false);
      setMessage(deleteError.message);
      return;
    }

    if (cleanedEntries.length > 0) {
      const { error: insertError } = await supabase.from("cv_entries").insert(cleanedEntries);
      if (insertError) {
        setSaving(false);
        setMessage(insertError.message);
        return;
      }
    }

    setSaving(false);
    router.refresh();
    setMessage(
      updatedCv.is_public
        ? `Saved and published at /cv/${updatedCv.slug}.`
        : "Saved. Enable Publicly visible to publish this CV."
    );
  }

  const previewHref = savedIsPublic ? `/cv/${cv.slug}` : `/admin/cvs/${cv.id}/preview`;
  const previewLabel = savedIsPublic ? "View public page" : "Preview draft";
  const visibilityPending = cv.is_public && !savedIsPublic;
  const coverage = (cv.jd_coverage ?? []) as JdCoverageItem[];
  const hasCoverage = coverage.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
        >
          {previewLabel}
        </a>
        {savedIsPublic && <p className="text-xs text-green-700">This CV is publicly visible.</p>}
        {visibilityPending && (
          <p className="text-xs text-amber-700">Public visibility is checked but not saved yet.</p>
        )}
      </div>
      {importSource && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 text-sm">
          Imported via {importSource === "metadata" ? "embedded PDF metadata" : "layout parsing"}.
          Review all fields before publishing. Profile images are not included in PDF imports.
          Enable Publicly visible and save to publish at /cv/{cv.slug}.
        </div>
      )}
      <section className="bg-white border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a2744]">CV Details</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Title" value={cv.title} onChange={(v) => setCv((prev) => ({ ...prev, title: v }))} />
          <div>
            <Input label="Slug" value={cv.slug} onChange={(v) => setCv((prev) => ({ ...prev, slug: v }))} />
            <p className="text-xs text-gray-500 mt-1">Public URL: /cv/{cv.slug || "your-slug"}</p>
          </div>
          <Input
            label="Target role"
            value={cv.target_role}
            onChange={(v) => setCv((prev) => ({ ...prev, target_role: v }))}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Input
            label="Full name"
            value={cv.full_name}
            onChange={(v) => setCv((prev) => ({ ...prev, full_name: v }))}
          />
          <Input
            label="Profile image URL"
            value={cv.profile_image_url ?? ""}
            onChange={(v) => setCv((prev) => ({ ...prev, profile_image_url: v }))}
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Upload profile image</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void uploadProfileImage(file);
                }
              }}
              className="w-full border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max 5MB. PNG, JPG, or WEBP. {uploadingImage ? "Uploading..." : ""}
            </p>
          </div>
          <Input label="Email" value={cv.email ?? ""} onChange={(v) => setCv((prev) => ({ ...prev, email: v }))} />
          <Input label="Phone" value={cv.phone ?? ""} onChange={(v) => setCv((prev) => ({ ...prev, phone: v }))} />
          <Input
            label="City"
            value={cv.city ?? ""}
            onChange={(v) => setCv((prev) => ({ ...prev, city: v }))}
          />
          <Input
            label="Country"
            value={cv.country ?? ""}
            onChange={(v) => setCv((prev) => ({ ...prev, country: v }))}
          />
          <Input
            label="LinkedIn"
            value={cv.linkedin ?? ""}
            onChange={(v) => setCv((prev) => ({ ...prev, linkedin: v }))}
          />
          <Input
            label="GitHub"
            value={cv.github ?? ""}
            onChange={(v) => setCv((prev) => ({ ...prev, github: v }))}
          />
          <Input
            label="Website"
            value={cv.website ?? ""}
            onChange={(v) => setCv((prev) => ({ ...prev, website: v }))}
          />
        </div>

        <RichTextarea
          label="Description"
          value={cv.summary ?? ""}
          onChange={(value) => setCv((prev) => ({ ...prev, summary: value }))}
          minHeightClassName="min-h-24"
        />

        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={cv.is_public}
            onChange={(e) => setCv((prev) => ({ ...prev, is_public: e.target.checked }))}
          />
          Publicly visible
        </label>
      </section>

      {hasCoverage && (
        <section className="bg-white border border-gray-200 p-6 space-y-4">
          <button
            type="button"
            onClick={() => setCoverageOpen((open) => !open)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="text-sm font-semibold text-[#1a2744]">JD Match</h2>
            <span className="text-xs text-gray-500">{coverageOpen ? "Hide" : "Show"}</span>
          </button>
          {coverageOpen && (
            <div className="space-y-3">
              {cv.company_name && (
                <p className="text-xs text-gray-500">
                  Tailored for <span className="font-medium text-[#1a2744]">{cv.company_name}</span>
                </p>
              )}
              {coverage.map((item, index) => (
                <div key={`${item.requirement}-${index}`} className="border border-gray-100 p-3 space-y-1">
                  <div className="flex items-start gap-2">
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 shrink-0 ${coverageStatusClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                    <p className="text-sm text-[#1a2744]">{item.requirement}</p>
                  </div>
                  <p className="text-xs text-gray-500">{item.evidence}</p>
                  {item.status === "missing" && (
                    <p className="text-xs text-amber-700">
                      Consider adding this to your skills pool or experience before publishing.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {sections.map((section) => {
        const sectionEntries = sortedEntryRefs.filter((x) => x.entry.section === section);
        const entriesContainerClassName = "space-y-4 max-h-[420px] overflow-y-auto pr-1";

        return (
          <section key={section} className="bg-white border border-gray-200 p-6 space-y-4">
            <div className="flex items-center">
              <h2 className="text-sm font-semibold text-[#1a2744] capitalize">{section}</h2>
              <button
                type="button"
                onClick={() => addEntry(section)}
                className="ml-auto text-xs border border-dashed border-[#1a2744]/40 px-3 py-1.5"
              >
                + Add item
              </button>
            </div>

            {section === skillsSection ? (
              <div className={entriesContainerClassName}>
                {sectionEntries.length === 0 && <p className="text-sm text-gray-500">No skills yet.</p>}
                <div className="space-y-3">
                  {sectionEntries.map(({ entry, index }) => (
                    <div key={`${section}-${index}`} className="border border-gray-100 p-4 space-y-3">
                      <div className="grid md:grid-cols-3 gap-3">
                        <Input
                          label="Order"
                          value={String(entry.item_order)}
                          onChange={(v) => updateEntry(index, "item_order", Number(v))}
                        />
                        <Input
                          label="Category"
                          value={entry.title}
                          onChange={(v) => updateEntry(index, "title", v)}
                        />
                        <Input
                          label="Skills list (comma separated)"
                          value={entry.description ?? ""}
                          onChange={(v) => updateEntry(index, "description", v)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEntry(index)}
                        className="text-xs text-red-500 border border-red-200 px-3 py-1.5 hover:bg-red-50"
                      >
                        Remove item
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={entriesContainerClassName}>
                {sectionEntries.length === 0 && <p className="text-sm text-gray-500">No items yet.</p>}

                {sectionEntries.map(({ entry, index }) => (
                  <div key={`${section}-${index}`} className="border border-gray-100 p-4 space-y-3">
                    <div className={`grid gap-3 ${compactSections.includes(section) ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
                      <Input
                        label="Order"
                        value={String(entry.item_order)}
                        onChange={(v) => updateEntry(index, "item_order", Number(v))}
                      />
                      <Input
                        label={section === "languages" ? "Language" : "Title"}
                        value={entry.title}
                        onChange={(v) => updateEntry(index, "title", v)}
                      />
                      <Input
                        label={section === "languages" ? "Level (optional)" : "Subtitle"}
                        value={entry.subtitle ?? ""}
                        onChange={(v) => updateEntry(index, "subtitle", v)}
                      />
                      {!compactSections.includes(section) && (
                        <Input
                          label="Date label"
                          value={entry.date_label ?? ""}
                          onChange={(v) => updateEntry(index, "date_label", v)}
                        />
                      )}
                    </div>

                    {!noDescriptionSections.includes(section) && (
                      <RichTextarea
                        label="Description"
                        value={entry.description ?? ""}
                        onChange={(value) => updateEntry(index, "description", value)}
                        minHeightClassName="min-h-20"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => removeEntry(index)}
                      className="text-xs text-red-500 border border-red-200 px-3 py-1.5 hover:bg-red-50"
                    >
                      Remove item
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={saveAll}
          disabled={saving || uploadingImage}
          className="bg-[#1a2744] text-white px-6 py-2 text-sm hover:bg-[#243256] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save CV"}
        </button>
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}

function coverageStatusClass(status: JdCoverageItem["status"]): string {
  switch (status) {
    case "strong":
      return "bg-green-100 text-green-800";
    case "partial":
      return "bg-amber-100 text-amber-800";
    case "missing":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

