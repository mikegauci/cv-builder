import CvListManager from "@/components/CvListManager";
import { getAllCvs } from "@/lib/cv-data";

export default async function AdminCvsPage() {
  const cvs = await getAllCvs();

  return (
    <div>
      <h1 className="text-2xl font-light text-[#1a2744] mb-2">CVs</h1>
      <p className="text-sm text-gray-500 mb-10">
        Create multiple CV versions and tailor each one for a specific job.
      </p>

      <CvListManager initialCvs={cvs} />
    </div>
  );
}
