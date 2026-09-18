import type { CvWithEntries } from "@/lib/types";

export const MASTER_CV_TITLES = [
  "Engineering Manager",
  "Senior Frontend Engineer & Product Owner",
  "Technical Product Owner",
  "Senior Frontend Engineer",
  "Senior Full Stack Engineer",
] as const;

const MASTER_TITLE_SET = new Set(
  MASTER_CV_TITLES.map((title) => title.trim().toLowerCase())
);

export function isMasterCvTitle(title: string): boolean {
  return MASTER_TITLE_SET.has(title.trim().toLowerCase());
}

export function filterMasterSourceCvs(sourceCvs: CvWithEntries[]): CvWithEntries[] {
  const masterCvs = sourceCvs.filter((source) => isMasterCvTitle(source.cv.title));

  if (masterCvs.length === 0) {
    console.warn("[generate-cv] No master CVs matched; falling back to all source CVs", {
      availableTitles: sourceCvs.map((source) => source.cv.title),
    });
    return sourceCvs;
  }

  return masterCvs;
}
