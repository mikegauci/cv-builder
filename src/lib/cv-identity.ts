import type { Cv, CvWithEntries } from "@/lib/types";

const IDENTITY_FIELDS = [
  "full_name",
  "profile_image_url",
  "email",
  "phone",
  "city",
  "country",
  "linkedin",
  "github",
  "website",
] as const satisfies readonly (keyof Cv)[];

export function resolveCvIdentity(sourceCvs: CvWithEntries[]): Cv {
  const base = sourceCvs[0]?.cv;
  if (!base) {
    throw new Error("No source CV available for identity fields.");
  }

  const resolved = { ...base };

  for (const field of IDENTITY_FIELDS) {
    for (const source of sourceCvs) {
      const value = source.cv[field];
      if (typeof value === "string" && value.trim()) {
        (resolved[field] as string) = value.trim();
        break;
      }
    }
  }

  return resolved;
}
