export type CvSectionType =
  | "experience"
  | "education"
  | "languages"
  | "skills"
  | "courses"
  | "projects"
  | "certifications";

export type SkillProficiency = "expert" | "proficient" | "familiar";

export type JdCoverageStatus = "strong" | "partial" | "missing";

export interface JdCoverageItem {
  requirement: string;
  status: JdCoverageStatus;
  evidence: string;
}

export interface JdAnalysis {
  company_name: string | null;
  role_title: string;
  seniority_level: string;
  domain: string;
  jd_summary: string;
  must_have_requirements: string[];
  nice_to_haves: string[];
  core_responsibilities: string[];
  tech_stack: string[];
  ats_keywords: string[];
}

export interface Cv {
  id: number;
  title: string;
  slug: string;
  target_role: string;
  summary: string | null;
  full_name: string;
  profile_image_url: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  linkedin: string | null;
  github: string | null;
  website: string | null;
  is_public: boolean;
  company_name: string | null;
  job_description: string | null;
  jd_analysis: JdAnalysis | null;
  jd_coverage: JdCoverageItem[] | null;
  created_at: string;
  updated_at: string;
}

export interface CvEntry {
  id: number;
  cv_id: number;
  section: CvSectionType;
  item_order: number;
  title: string;
  subtitle: string | null;
  date_label: string | null;
  description: string | null;
}

export interface CvWithEntries {
  cv: Cv;
  entries: CvEntry[];
}

export interface SkillPoolItem {
  id: number;
  category: string;
  name: string;
  proficiency: SkillProficiency;
  context: string | null;
  item_order: number;
  created_at: string;
}

export interface CoverLetter {
  id: number;
  cv_id: number | null;
  slug: string;
  role: string;
  company_name: string;
  body: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CoverLetterWithCv {
  coverLetter: CoverLetter;
  cv: Cv | null;
}
