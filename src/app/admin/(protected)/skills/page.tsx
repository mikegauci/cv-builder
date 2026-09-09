import SkillPoolManager from "@/components/SkillPoolManager";
import { getSkillPool } from "@/lib/skill-pool-data";

export default async function SkillsPage() {
  const skills = await getSkillPool();

  return (
    <div>
      <h1 className="text-2xl font-light text-[#1a2744] mb-2">Skills Pool</h1>
      <p className="text-sm text-gray-500 mb-8">
        Manage the master list of skills used when generating JD-tailored CVs.
      </p>

      <SkillPoolManager initialSkills={skills} />
    </div>
  );
}
