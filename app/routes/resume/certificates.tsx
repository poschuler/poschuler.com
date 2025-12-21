import { useLoaderData } from "react-router";
import { Section } from "~/components/section";
import type { loader } from "./_resume";

export function Certificates() {
  let { certificates } = useLoaderData<typeof loader>();

  return (
    <Section title="Certificates">
      <div className="-mx-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
        {certificates.map((cert) => (
          <div
            key={cert.row}
            className="flex flex-col overflow-hidden rounded-lg border border-default bg-subtle p-3 text-card-foreground"
          >
            <div className="flex flex-col space-y-1.5">
              <div className="space-y-1">
                <h3 className="text-base font-semibold tracking-tight">
                  <a
                    className="inline-flex items-center gap-1 hover:underline"
                    target="_blank"
                    href={cert.url}
                    rel="noreferrer"
                  >
                    {cert.name}
                  </a>
                </h3>
                <p className="font-mono text-xs text-muted-foreground">
                  {cert.issuer}
                </p>
              </div>
            </div>
            <div className="mt-auto flex text-pretty font-mono text-sm text-muted-foreground">
              <div className="mt-2 flex flex-wrap gap-1">
                {cert.keywords.map((item) => (
                  <div
                    key={`${cert.row}-${item}`}
                    className="inline-flex items-center text-nowrap rounded-md border border-transparent bg-secondary px-1 py-0 font-mono text-[10px] font-semibold text-secondary-foreground transition-colors hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
