import Link from "next/link";
import { notFound } from "next/navigation";
import CvEditor from "@/components/CvEditor";
import { getCvById } from "@/lib/cv-data";

export default async function EditCvPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imported?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const cvId = Number(resolvedParams.id);
  const data = await getCvById(cvId);
  const importSource =
    resolvedSearchParams.imported === "metadata" || resolvedSearchParams.imported === "layout"
      ? resolvedSearchParams.imported
      : undefined;

  if (!data) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/cvs" className="text-sm text-gray-500 hover:text-[#1a2744]">
          ← Back to CV list
        </Link>
      </div>

      <h1 className="text-2xl font-light text-[#1a2744] mb-2">Edit CV</h1>
      <p className="text-sm text-gray-500 mb-8">Update details and sections, then save.</p>

      <CvEditor initialData={data} importSource={importSource} />
    </div>
  );
}
