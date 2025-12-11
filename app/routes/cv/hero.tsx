import {
  DownloadIcon,
  GitHubLogoIcon,
  LinkedInLogoIcon,
  TwitterLogoIcon,
} from "@radix-ui/react-icons";
import { Link, useLoaderData } from "react-router";
import { Globe, Mail } from "lucide-react";
import type { loader } from "./_cv";

export function Hero() {
  let {
    basics: {
      name,
      label,
      image,
      location: { city, region, url, countryCode },
      profiles,
      email,
    },
    languages,
  } = useLoaderData<typeof loader>();

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 space-y-1.5">
        <h1 className="text-2xl font-bold">{name}</h1>
        <p className="max-w-md text-pretty font-mono text-sm text-muted-foreground">
          {label}
        </p>
        <p className="max-w-md items-center text-pretty font-mono text-xs text-muted-foreground">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex gap-x-1.5 align-baseline leading-none hover:underline"
          >
            <Globe className="size-3" />
            {city}, {region}, {countryCode}
          </a>
        </p>
        <div className="mt-auto flex text-pretty font-mono text-sm text-muted-foreground">
          <div className="mt-1 flex flex-wrap gap-1">
            {languages.map((item) => (
              <div
                key={item.row}
                className="inline-flex items-center text-nowrap rounded-md border border-transparent bg-subtle px-1 py-0 font-mono text-[10px] font-semibold text-secondary-foreground transition-colors hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {`${item.language} - ${item.fluency}`}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-x-1 pt-1 font-mono text-sm text-muted-foreground">
          <a
            href={`mailto:${email}`}
            title={`Mail to ${email}`}
            className="inline-flex size-8 items-center justify-center whitespace-nowrap rounded-md border border-default border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-active hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
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
              className="inline-flex size-8 items-center justify-center whitespace-nowrap rounded-md border border-default border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-active hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {profile.network === "GitHub" && (
                <GitHubLogoIcon className="size-4" />
              )}

              {profile.network === "LinkedIn" && (
                <LinkedInLogoIcon className="size-4" />
              )}

              {profile.network === "X" && (
                <TwitterLogoIcon className="size-4" />
              )}
            </a>
          ))}
        </div>

        <div className="flex gap-x-1 pt-1 font-mono text-sm text-muted-foreground">
          <Link
            to="/cv.pdf"
            reloadDocument
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-default border-input bg-background text-xs font-medium ring-offset-background transition-colors hover:bg-active hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 p-2"
          >
            <DownloadIcon className="size-4 mr-2" />
            <span>Download as PDF</span>
          </Link>
        </div>

        <div className="flex gap-x-1 pt-1 font-mono text-sm text-muted-foreground"></div>
      </div>
      <span className="flex size-28 shrink-0 overflow-hidden rounded-xl">
        <img src={image} alt={name} className="aspect-square h-full w-full" />
      </span>
    </div>
  );
}
