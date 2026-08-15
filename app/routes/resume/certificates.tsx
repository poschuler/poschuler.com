import { Section } from "./section";
import { certificates } from "./resume.json";

export function Certificates() {
  return (
    <Section title="Certificates">
      {/* Two columns, not three. The page column is `max-w-measure`, so a third
        * column left each card about 200px — narrower than the certificate
        * names it has to hold. The `-mx-3` that pulled this grid outside the
        * column went with it. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
        {certificates.map((cert) => (
          <article
            key={cert.row}
            className="flex flex-col rounded-lg border border-default p-3"
          >
            <h3 className="font-sans font-semibold text-base tracking-tight">
              <a
                className="transition-colors duration-200 hover:text-low"
                target="_blank"
                href={cert.url}
                rel="noopener noreferrer"
              >
                {cert.name}
              </a>
            </h3>

            <p className="mt-1 text-low text-xs">{cert.issuer}</p>

            <ul className="mt-auto flex flex-wrap gap-1 pt-2">
              {cert.keywords.map((item) => (
                <li
                  key={`${cert.row}-${item}`}
                  className="inline-flex items-center text-nowrap rounded-md border border-default px-2 py-0.5 font-semibold text-low text-xs"
                >
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Section>
  );
}
