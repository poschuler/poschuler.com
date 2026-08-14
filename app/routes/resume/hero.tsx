import { Link } from "react-router";
import { Download, Globe, Mail } from "lucide-react";
import { BrandNetworkIcon } from "~/components/ui/brand-icons";
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
    <div className="flex items-center justify-between">
      <div className="flex-1 space-y-1.5">
        <h1 className="text-2xl font-bold">{name}</h1>
        <p className="max-w-md text-pretty font-mono text-sm text-low">
          {label}
        </p>
        {/* Plain text, not a link: the timezone is the part a distributed team
          * screens on, and a map of the city answers a question nobody asked. */}
        <p className="max-w-md items-center text-pretty font-mono text-xs text-low">
          <span className="inline-flex gap-x-1.5 align-baseline leading-none">
            <Globe className="size-3" />
            {city}, {region} · {timezone}
          </span>
        </p>
        <div className="mt-auto flex text-pretty font-mono text-sm text-low">
          <div className="mt-1 flex flex-wrap gap-1">
            {languages.map((item) => (
              <div
                key={item.row}
                className="inline-flex items-center rounded-md border border-transparent bg-subtle px-1 py-0 font-mono text-[10px] font-semibold text-low"
              >
                {`${item.language} - ${item.fluency}`}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-x-1 pt-1 font-mono text-sm text-low">
          <a
            href={`mailto:${email}`}
            title={`Mail to ${email}`}
            className="inline-flex size-8 items-center justify-center whitespace-nowrap rounded-md border border-default bg-app text-sm font-medium transition-colors hover:bg-active hover:text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default disabled:pointer-events-none disabled:opacity-50"
          >
            <Mail className="size-4" />
          </a>

          {profiles.map((profile) => (
            <a
              key={profile.network}
              href={`${profile.url}`}
              title={`${profile.network}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 items-center justify-center whitespace-nowrap rounded-md border border-default bg-app text-sm font-medium transition-colors hover:bg-active hover:text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default disabled:pointer-events-none disabled:opacity-50"
            >
              <BrandNetworkIcon network={profile.network} className="size-4" />
            </a>
          ))}
        </div>

        <div className="flex gap-x-1 pt-1 font-mono text-sm text-low">
          <Link
            to="/resume.pdf"
            reloadDocument
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-default bg-app text-xs font-medium transition-colors hover:bg-active hover:text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default disabled:pointer-events-none disabled:opacity-50 p-2"
          >
            <Download className="size-4 mr-2" />
            <span>Download as PDF</span>
          </Link>
        </div>

        <div className="flex gap-x-1 pt-1 font-mono text-sm text-low"></div>
      </div>
      <span className="flex size-28 shrink-0 overflow-hidden rounded-xl">
        <img
          src={image}
          alt={name}
          width={112}
          height={112}
          className="aspect-square h-full w-full"
        />
      </span>
    </div>
  );
}
