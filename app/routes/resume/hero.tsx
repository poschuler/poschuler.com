import { Link } from "react-router";
import { Download, Globe, Mail } from "lucide-react";

import { BrandNetworkIcon } from "~/components/ui/brand-icons";
import { Button } from "~/components/ui/button";
import { basics, languages } from "./resume.json";

export function Hero() {
  let {
    name,
    label,
    image,
    location: { city, region, timezone },
    profiles,
    email,
  } = basics;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-1.5">
        <h1 className="font-sans font-semibold text-2xl">{name}</h1>

        <p className="max-w-md text-pretty text-low text-sm">{label}</p>

        {/* Plain text, not a link: the timezone is the part a distributed team
          * screens on, and a map of the city answers a question nobody asked. */}
        <p className="inline-flex items-center gap-x-1.5 text-low text-xs">
          <Globe className="size-3 shrink-0" aria-hidden />
          {city}, {region} · {timezone}
        </p>

        {/* `text-xs`, like every other chip on the page. These were
          * `text-[10px]` with no vertical padding — the only two arbitrary
          * font sizes in the tree, and small enough to stop being readable. */}
        <ul className="flex flex-wrap gap-1 pt-1">
          {languages.map((item) => (
            <li
              key={item.row}
              className="inline-flex items-center rounded-md border border-default px-2 py-0.5 font-semibold text-low text-xs"
            >
              {`${item.language} — ${item.fluency}`}
            </li>
          ))}
        </ul>

        {/* The site's own button, rendered as the anchor each one needs. These
          * were three copies of a fifteen-class string that had drifted from
          * the component in two places. */}
        <div className="flex flex-wrap items-center gap-1 pt-2">
          <Button
            variant="outline"
            size="icon"
            render={<a href={`mailto:${email}`} title={`Mail to ${email}`} />}
          >
            <Mail className="size-4" />
            <span className="sr-only">Email {name}</span>
          </Button>

          {profiles.map((profile) => (
            <Button
              key={profile.network}
              variant="outline"
              size="icon"
              render={
                <a
                  href={profile.url}
                  title={profile.network}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <BrandNetworkIcon network={profile.network} className="size-4" />
              <span className="sr-only">{profile.network}</span>
            </Button>
          ))}

          <Button
            variant="outline"
            render={<Link to="/resume.pdf" reloadDocument />}
          >
            <Download className="mr-2 size-4" />
            Download as PDF
          </Button>
        </div>
      </div>

      <span className="flex size-28 shrink-0 overflow-hidden rounded-xl">
        {/* `object-cover` for the same reason the home page portrait has it:
          * without it a source that is not exactly square is stretched. */}
        <img
          src={image}
          alt={name}
          width={112}
          height={112}
          className="size-full object-cover"
        />
      </span>
    </div>
  );
}
