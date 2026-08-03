import { notFound } from "next/navigation";
import CvView from "@/components/CvView";
import PublicNav from "@/components/PublicNav";
import { getPublicCvBySlug } from "@/lib/cv-data";

export default async function CvPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const data = await getPublicCvBySlug(resolvedParams.slug);

  if (!data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <PublicNav />
      <div className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <CvView data={data} />
        </div>
      </div>
    </div>
  );
}
