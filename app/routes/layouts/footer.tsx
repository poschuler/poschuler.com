import { CONTACT_LINKS, LOCATION } from "~/lib/contact";

/**
 * The bottom of every page, and the reason it exists: a reader who has just
 * finished an article is at the moment they are most likely to want to get in
 * touch, and until now the only way to was to navigate back to the home page
 * and find the contact row in the hero.
 *
 * `bg-subtle` matches the header, so the two bookend the column between them.
 * Nothing else in it — no copyright line, no year, no "built with". Those
 * name the site rather than serving the reader.
 */
export function Footer() {
  return (
    <footer className="border-default border-t bg-subtle px-4 py-6 font-mono text-low text-sm md:px-6">
      <div className="mx-auto flex w-full max-w-measure flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {CONTACT_LINKS.map(({ label, href }, index) => (
            <li key={href} className="flex items-center gap-x-2">
              {index > 0 && <span aria-hidden="true">·</span>}
              <a
                className="transition-colors duration-200 hover:text-default"
                href={href}
                {...(href.startsWith("mailto:")
                  ? {}
                  : { target: "_blank", rel: "noopener noreferrer" })}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        <p>{LOCATION}</p>
      </div>
    </footer>
  );
}
