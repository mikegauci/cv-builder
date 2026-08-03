import Link from "next/link";
import { getPublicCvs } from "@/lib/cv-data";

export default async function Home() {
  const cvs = await getPublicCvs();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <main className="max-w-5xl mx-auto">
        <div className="flex items-center mb-10">
          <div>
            <h1 className="text-3xl font-light text-[#1a2744]">CV Builder</h1>
            <p className="text-sm text-gray-500 mt-2">Public CVs available to view and download.</p>
          </div>
          <div className="ml-auto flex items-center gap-5">
            <Link href="/cover-letters" className="text-sm text-gray-500 hover:text-[#1a2744] transition-colors">
              Cover Letters
            </Link>
            <Link href="/admin/login" className="text-sm text-gray-500 hover:text-[#1a2744] transition-colors">
              Admin →
            </Link>
          </div>
        </div>

        {cvs.length === 0 && (
          <div className="bg-white border border-gray-200 p-8 text-sm text-gray-500">
            No public CVs yet. Publish one from the admin dashboard.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          {cvs.map((cv) => (
            <div key={cv.id} className="bg-white border border-gray-200 p-6">
              <p className="text-xs text-gray-500 mb-2">{cv.target_role}</p>
              <h2 className="text-lg font-semibold text-[#1a2744] mb-3">{cv.title}</h2>
              <p className="text-sm text-gray-600 mb-4">{cv.summary || "No summary yet."}</p>
              <Link href={`/cv/${cv.slug}`} className="text-sm text-[#1a2744] hover:underline">
                View CV →
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
