import Link from "next/link";
import { getPublicCoverLetters } from "@/lib/cover-letter-data";

export default async function CoverLettersPage() {
  const coverLetters = await getPublicCoverLetters();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <main className="max-w-5xl mx-auto">
        <div className="flex items-center mb-10">
          <div>
            <h1 className="text-3xl font-light text-[#1a2744]">Cover Letters</h1>
            <p className="text-sm text-gray-500 mt-2">Public cover letters available to view.</p>
          </div>
          <Link href="/" className="ml-auto text-sm text-gray-500 hover:text-[#1a2744] transition-colors">
            ← Home
          </Link>
        </div>

        {coverLetters.length === 0 && (
          <div className="bg-white border border-gray-200 p-8 text-sm text-gray-500">
            No public cover letters yet.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          {coverLetters.map((cl) => (
            <div key={cl.id} className="bg-white border border-gray-200 p-6">
              <p className="text-xs text-gray-500 mb-2">{cl.role}</p>
              <h2 className="text-lg font-semibold text-[#1a2744] mb-4">{cl.company_name}</h2>
              <Link
                href={`/cover-letter/${cl.slug}`}
                className="text-sm text-[#1a2744] hover:underline"
              >
                View cover letter →
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
