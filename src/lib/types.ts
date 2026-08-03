export type CvSectionType =
  | "experience"
  | "education"
  | "languages"
  | "skills"
  | "courses"
  | "projects"
  | "certifications";

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
