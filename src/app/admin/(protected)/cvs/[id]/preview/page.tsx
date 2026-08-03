import Link from "next/link";
import { notFound } from "next/navigation";
import CvView from "@/components/CvView";
import { getCvById } from "@/lib/cv-data";

export default async function PreviewCvPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const cvId = Number(resolvedParams.id);
  const data = await getCvById(cvId);

  if (!data) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href={`/admin/cvs/${data.cv.id}`} className="text-sm text-gray-500 hover:text-[#1a2744]">
          ← Back to editor
        </Link>
        {!data.cv.is_public && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5">
            Draft preview. Enable Publicly visible and save to publish at /cv/{data.cv.slug}.
          </p>
        )}
      </div>

      <CvView data={data} />
    </div>
  );
}
