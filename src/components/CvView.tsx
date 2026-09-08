import DownloadCvButton from "@/components/DownloadCvButton";
import FormattedText from "@/components/FormattedText";
import type { CvEntry, CvSectionType, CvWithEntries } from "@/lib/types";

function groupEntries(entries: CvEntry[]) {
  return entries.reduce<Record<string, CvEntry[]>>((acc, entry) => {
    if (!acc[entry.section]) {
      acc[entry.section] = [];
    }
    acc[entry.section].push(entry);
    return acc;
  }, {});
}

const sectionOrder: CvSectionType[] = ["experience", "education", "languages", "skills", "courses"];
const compactSections: CvSectionType[] = ["languages", "skills"];
const noDescriptionSections: CvSectionType[] = ["courses"];

function sectionLabel(section: string) {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `https://${url}`;
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor">
      <path d="M4 5.75A1.75 1.75 0 0 1 5.75 4h12.5A1.75 1.75 0 0 1 20 5.75v8.5A1.75 1.75 0 0 1 18.25 16h-4.93l.53 2H16a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h2.15l.53-2H5.75A1.75 1.75 0 0 1 4 14.25v-8.5ZM6 6v8h12V6H6Z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor">
      <path d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25V6.75Zm2.2-.25L12 11.22l6.8-4.72H5.2Zm13.3 2.22-5.94 4.13a1 1 0 0 1-1.12 0L5.5 8.72v8.53c0 .41.34.75.75.75h11.5c.41 0 .75-.34.75-.75V8.72Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor">
      <path d="M6.62 2.67a1 1 0 0 1 1.07-.24l3.1 1.03a1 1 0 0 1 .66.86l.2 2.6a1 1 0 0 1-.29.8L9.66 9.4a13.11 13.11 0 0 0 4.94 4.94l1.68-1.7a1 1 0 0 1 .8-.28l2.6.2a1 1 0 0 1 .86.66l1.03 3.1a1 1 0 0 1-.24 1.07l-1.4 1.4a3 3 0 0 1-3.12.72c-2.95-1-5.72-2.87-8.24-5.38-2.51-2.52-4.38-5.29-5.38-8.24a3 3 0 0 1 .72-3.12l1.4-1.4Z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor">
      <path d="M12 2a7 7 0 0 0-7 7c0 4.85 5.46 11.56 6.08 12.3a1.2 1.2 0 0 0 1.84 0C13.54 20.56 19 13.85 19 9a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor">
      <path d="M6.94 8.5H3.56V20h3.38V8.5Zm-1.69-1.9a1.97 1.97 0 1 0 0-3.94 1.97 1.97 0 0 0 0 3.94ZM20.44 20h-3.38v-5.62c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97V20H9.66V8.5h3.24v1.57h.05c.45-.86 1.55-1.77 3.19-1.77 3.42 0 4.05 2.25 4.05 5.17V20Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.71c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.54 2.35 1.1 2.92.84.09-.65.35-1.1.63-1.36-2.22-.26-4.56-1.11-4.56-4.95 0-1.1.39-2 1.03-2.7-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.03A9.54 9.54 0 0 1 12 6.84c.85 0 1.7.12 2.5.35 1.91-1.3 2.75-1.03 2.75-1.03.55 1.4.2 2.45.1 2.71.64.7 1.03 1.6 1.03 2.7 0 3.85-2.34 4.69-4.58 4.94.36.31.68.91.68 1.84v2.73c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

export default function CvView({ data, showDownload = true }: { data: CvWithEntries; showDownload?: boolean }) {
  const grouped = groupEntries(data.entries);
  const location = [data.cv.city, data.cv.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-xl text-[#1a2744] font-semibold">{data.cv.title}</h1>
        {showDownload && (
          <div className="ml-auto">
            <DownloadCvButton data={data} />
          </div>
        )}
      </div>

      <article className="bg-white border border-gray-200 p-8 md:p-10">
        <header className="border-b border-gray-200 pb-5 mb-6">
          <div className="flex items-start gap-4">
            {data.cv.profile_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.cv.profile_image_url}
                alt={`${data.cv.full_name} profile`}
                width={80}
                height={80}
                className="rounded border border-gray-200 object-cover"
              />
            )}
            <div>
              <h2 className="text-3xl font-bold text-[#1a2744]">{data.cv.full_name}</h2>
              <p className="text-sm font-semibold text-gray-600 mt-2">{data.cv.target_role}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
            {data.cv.email && (
              <a
                href={`mailto:${data.cv.email}`}
                className="inline-flex items-center gap-1 hover:text-[#1a2744] underline-offset-2 hover:underline"
              >
                <EmailIcon />
                {data.cv.email}
              </a>
            )}
            {data.cv.phone && (
              <a
                href={`tel:${data.cv.phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1 hover:text-[#1a2744] underline-offset-2 hover:underline"
              >
                <PhoneIcon />
                {data.cv.phone}
              </a>
            )}
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon />
                {location}
              </span>
            )}
            {data.cv.linkedin && (
              <a
                href={normalizeUrl(data.cv.linkedin)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#1a2744] underline-offset-2 hover:underline"
              >
                <LinkedInIcon />
                <span>LinkedIn</span>
              </a>
            )}
            {data.cv.github && (
              <a
                href={normalizeUrl(data.cv.github)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#1a2744] underline-offset-2 hover:underline"
              >
                <GitHubIcon />
                <span>GitHub</span>
              </a>
            )}
            {data.cv.website && (
              <a
                href={normalizeUrl(data.cv.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#1a2744] underline-offset-2 hover:underline"
              >
                <WebsiteIcon />
                <span>Portfolio</span>
              </a>
            )}
          </div>
          {data.cv.summary && (
            <FormattedText text={data.cv.summary} className="text-sm text-gray-700 mt-4 leading-6" />
          )}
        </header>

        <div className="space-y-7">
          {sectionOrder
            .filter((section) => grouped[section]?.length)
            .map((section, index) => (
              <section key={section} className={index === 0 ? "" : "border-t border-gray-200 pt-4"}>
                <h3 className="text-lg font-semibold tracking-wider text-gray-500 uppercase mb-3">
                  {sectionLabel(section)}
                </h3>
                {section === "languages" ? (
                  <p className="text-sm text-gray-800">
                    {grouped[section].map((entry, entryIndex) => (
                      <span key={entry.id}>
                        <span className="font-semibold text-[#1a2744]">{entry.title}</span>
                        {entry.subtitle ? ` (${entry.subtitle})` : ""}
                        {entryIndex < grouped[section].length - 1 ? " | " : ""}
                      </span>
                    ))}
                  </p>
                ) : section === "skills" ? (
                  <ul className="list-disc pl-6 space-y-1">
                    {grouped[section].map((entry) => (
                      <li key={entry.id} className="text-sm text-gray-800">
                        <span className="font-semibold text-[#1a2744]">{entry.title}:</span>{" "}
                        {entry.description || entry.subtitle || ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="space-y-6">
                    {grouped[section].map((entry) => (
                      <div key={entry.id}>
                        <div className="flex items-start gap-2">
                          <div>
                            <p className="text-md font-semibold text-[#1a2744]">{entry.title}</p>
                            {entry.subtitle && <p className="text-sm text-gray-600">{entry.subtitle}</p>}
                          </div>
                          {!compactSections.includes(section) && entry.date_label && (
                            <p className="text-xs text-gray-500 ml-auto">{entry.date_label}</p>
                          )}
                        </div>
                        {entry.description && !noDescriptionSections.includes(section) && (
                          <FormattedText text={entry.description} className="text-sm text-gray-700 mt-2 leading-6" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

          {Object.entries(grouped)
            .filter(([section]) => !sectionOrder.includes(section as CvSectionType))
            .map(([section, entries]) => (
              <section key={section} className="border-t border-gray-200 pt-4">
                <h3 className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">
                  {sectionLabel(section)}
                </h3>
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <div key={entry.id}>
                      <div className="flex items-start gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#1a2744]">{entry.title}</p>
                          {entry.subtitle && <p className="text-sm text-gray-600">{entry.subtitle}</p>}
                        </div>
                        {!compactSections.includes(section as CvSectionType) && entry.date_label && (
                          <p className="text-xs text-gray-500 ml-auto">{entry.date_label}</p>
                        )}
                      </div>
                      {entry.description && !noDescriptionSections.includes(section as CvSectionType) && (
                        <FormattedText text={entry.description} className="text-sm text-gray-700 mt-2 leading-6" />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      </article>
    </div>
  );
}
