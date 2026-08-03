"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PublicNav() {
  const router = useRouter();

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-[#1a2744] transition-colors"
        >
          ← Back
        </button>

        <div className="h-4 w-px bg-gray-200" />

        <div className="flex items-center gap-5">
          <Link href="/" className="text-sm text-gray-500 hover:text-[#1a2744] transition-colors">
            CVs
          </Link>
          <Link href="/cover-letters" className="text-sm text-gray-500 hover:text-[#1a2744] transition-colors">
            Cover Letters
          </Link>
        </div>
      </div>
    </nav>
  );
}
