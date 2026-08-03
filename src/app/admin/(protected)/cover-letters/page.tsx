import { getAllCoverLetters } from "@/lib/cover-letter-data";
import { getAllCvs } from "@/lib/cv-data";
import CoverLetterListManager from "@/components/CoverLetterListManager";

export default async function CoverLettersPage() {
  const [coverLetters, cvs] = await Promise.all([getAllCoverLetters(), getAllCvs()]);

  return (
    <div>
      <h1 className="text-2xl font-light text-[#1a2744] mb-2">Cover Letters</h1>
      <p className="text-sm text-gray-500 mb-8">Create and manage your cover letters.</p>

      <CoverLetterListManager initialCoverLetters={coverLetters} allCvs={cvs} />
    </div>
  );
}
