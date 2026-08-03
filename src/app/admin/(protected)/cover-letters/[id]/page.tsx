import Link from "next/link";
import { notFound } from "next/navigation";
import CoverLetterEditor from "@/components/CoverLetterEditor";
import { getCoverLetterById } from "@/lib/cover-letter-data";
import { getAllCvs } from "@/lib/cv-data";

export default async function EditCoverLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = Number(resolvedParams.id);
  const [data, allCvs] = await Promise.all([getCoverLetterById(id), getAllCvs()]);

  if (!data) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/cover-letters" className="text-sm text-gray-500 hover:text-[#1a2744]">
          ← Back to cover letters
        </Link>
      </div>

      <h1 className="text-2xl font-light text-[#1a2744] mb-2">Edit Cover Letter</h1>
      <p className="text-sm text-gray-500 mb-8">
        {data.coverLetter.role} at {data.coverLetter.company_name}
      </p>

      <CoverLetterEditor initialData={data} allCvs={allCvs} />
    </div>
  );
}
