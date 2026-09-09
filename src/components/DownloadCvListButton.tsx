"use client";

import { useState } from "react";
import { downloadCvPdf } from "@/lib/cv-pdf-download";
import { supabase } from "@/lib/supabase";
import type { Cv, CvEntry } from "@/lib/types";

export default function DownloadCvListButton({ cv }: { cv: Cv }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);

    try {
      const { data: entries, error } = await supabase
        .from("cv_entries")
        .select("*")
        .eq("cv_id", cv.id)
        .order("item_order");

      if (error) {
        return;
      }

      await downloadCvPdf({ cv, entries: (entries ?? []) as CvEntry[] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownload()}
      disabled={loading}
      className="text-xs border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 shrink-0"
    >
      {loading ? "Downloading..." : "Download CV"}
    </button>
  );
}
