import { notFound } from "next/navigation";
import FormattedText from "@/components/FormattedText";
import CopyCoverLetterButton from "@/components/CopyCoverLetterButton";
import DownloadCoverLetterButton from "@/components/DownloadCoverLetterButton";
import PublicNav from "@/components/PublicNav";
import { getPublicCoverLetterBySlug } from "@/lib/cover-letter-data";
import { splitCoverLetterParagraphs } from "@/lib/cover-letter-plain-text";

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default async function CoverLetterPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const data = await getPublicCoverLetterBySlug(resolvedParams.slug);

  if (!data) {
    notFound();
  }

  const { coverLetter, cv } = data;

  return (
    <div className="min-h-screen bg-gray-100">
      <PublicNav />
      <div className="py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl text-[#1a2744] font-semibold">
            {coverLetter.role} — {coverLetter.company_name}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <DownloadCoverLetterButton coverLetter={coverLetter} cv={cv} />
            <CopyCoverLetterButton coverLetter={coverLetter} cv={cv} />
          </div>
        </div>

        <article className="bg-white border border-gray-200 p-8 md:p-12 space-y-4 text-sm text-gray-800 leading-relaxed">
          <p className="font-medium">Dear {coverLetter.company_name} Hiring Team,</p>

          {coverLetter.body && (
            <div className="space-y-3">
              {splitCoverLetterParagraphs(coverLetter.body).map((paragraph, index) => (
                <FormattedText key={index} text={paragraph} />
              ))}
            </div>
          )}

          <div className="pt-1">
            <p>Best regards,</p>
            <div className="mt-3 space-y-0.5">
              {cv ? (
                <>
                  <p className="font-semibold text-[#1a2744]">{cv.full_name}</p>
                  {cv.phone && <p>{cv.phone}</p>}
                  {cv.email && (
                    <p>
                      <a href={`mailto:${cv.email}`} className="underline hover:text-[#1a2744]">
                        {cv.email}
                      </a>
                    </p>
                  )}
                  {cv.linkedin && (
                    <p>
                      <a
                        href={normalizeUrl(cv.linkedin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-[#1a2744]"
                      >
                        {normalizeUrl(cv.linkedin)}
                      </a>
                    </p>
                  )}
                  {cv.website && (
                    <p>
                      <a
                        href={normalizeUrl(cv.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-[#1a2744]"
                      >
                        {normalizeUrl(cv.website)}
                      </a>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-gray-400 italic">No contact info linked.</p>
              )}
            </div>
          </div>
        </article>
      </div>
      </div>
    </div>
  );
}
