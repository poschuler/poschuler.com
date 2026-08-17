import { LOCALES, type Locale } from "~/context";
import {
  type DocumentIdentity,
  type SwitcherDestination,
  switcherDestination,
} from "~/lib/seo/alternates";

/**
 * The Locale switcher's destination, given the id of the deepest matched
 * route and that route's own loader data (Part 9 of
 * `evolution-plan/15-phase-3-spanish.md`).
 *
 * The switcher lives in the shared layout (`routes/layouts/header.tsx`),
 * above the `Outlet` that decides which page this is — so it reaches the
 * active page's data through `useMatches()` rather than a prop threaded down
 * from every route. This module is what turns that match into a
 * `DocumentIdentity`; `switcherDestination` in `app/lib/seo/alternates.ts` is
 * what turns the identity into a destination. Kept separate from that module
 * because this half is route-id plumbing — it knows the shapes
 * `app/routes.ts` mounts — where that half is pure address logic that knows
 * nothing about a route.
 *
 * `routeId` arrives with its Locale-branch suffix still on it: `app/routes.ts`
 * calls `contentRoutes` twice, once with no suffix for English and once with
 * `-es` for Spanish, so every page exists as two ids that share one shape —
 * `blog-slug` and `blog-slug-es`. Stripped here so one entry below covers
 * both.
 */
export function switcherDestinationForRoute(
  routeId: string,
  data: unknown,
  locale: Locale,
): SwitcherDestination | null {
  const identity = identityForRoute(routeId, data);

  return identity ? switcherDestination(identity.identity, locale, identity.existingLocales) : null;
}

/** A document route's own loader data — every one of them returns at least this much (see each route's `loader`). */
type DocumentLoaderData = { slug: string; existingLocales: readonly Locale[] };

function index(path: string): { identity: DocumentIdentity; existingLocales: readonly Locale[] } {
  return { identity: { kind: "index", path }, existingLocales: LOCALES };
}

/**
 * `data`, narrowed to a document route's own loader shape — or `null`.
 *
 * `useMatches()` types `loaderData` as possibly `undefined`, for a route
 * whose loader threw and is currently showing an `ErrorBoundary` instead. None
 * of the five document routes below declares its own boundary today, so a
 * thrown 404 renders from `root.tsx`'s instead — outside the shared layout,
 * where `LanguageSwitcher` never mounts to ask. Checked here anyway, rather
 * than trusted, so a boundary added to one of them later degrades to "render
 * nothing" instead of throwing on a destructure.
 */
function documentData<Extra extends Record<string, unknown> = Record<string, never>>(
  data: unknown,
): (DocumentLoaderData & Extra) | null {
  return data && typeof data === "object" && "slug" in data && "existingLocales" in data
    ? (data as DocumentLoaderData & Extra)
    : null;
}

/**
 * `null` for a route this function does not recognise — the layout and
 * resource routes `useMatches()` also reports, none of which is a page with a
 * destination to offer. The component treats `null` as "render nothing"
 * rather than guessing an address.
 */
function identityForRoute(
  routeId: string,
  data: unknown,
): { identity: DocumentIdentity; existingLocales: readonly Locale[] } | null {
  switch (routeId.replace(/-es$/, "")) {
    case "home":
      return index("/");
    case "bookmarks":
      return index("/bookmarks");
    case "timeline":
      return index("/timeline");
    case "blog":
      return index("/blog");
    case "projects":
      return index("/projects");
    case "series":
      return index("/series");
    case "tags":
      return index("/tags");
    // A Tag's own Translation may not exist even when the Tag itself does —
    // the switcher always offers the Tags index, never the literal
    // `/es/tags/:tag`, which the Tag itself might 404 at (Part 9).
    case "tag":
      return index("/tags");
    // The site's own 404 has no address of its own to translate — Part 9
    // sends it to the home page in the other Locale.
    case "catchall":
      return index("/");
    // No loader (`resume/_resume.tsx`'s own note explains why), so `data`
    // never arrives here — `index()` needs none of it, the same as every
    // other index below.
    case "resume":
      return index("/cv");
    case "blog-slug": {
      const doc = documentData(data);
      return doc && { identity: { kind: "post", slug: doc.slug, seriesSlug: null }, existingLocales: doc.existingLocales };
    }
    case "project-slug": {
      const doc = documentData(data);
      return doc && { identity: { kind: "project", slug: doc.slug }, existingLocales: doc.existingLocales };
    }
    case "project-note": {
      const doc = documentData<{ projectSlug: string }>(data);
      return (
        doc && {
          identity: { kind: "post", slug: doc.slug, seriesSlug: null, projectSlug: doc.projectSlug },
          existingLocales: doc.existingLocales,
        }
      );
    }
    case "series-slug": {
      const doc = documentData(data);
      return doc && { identity: { kind: "series", slug: doc.slug }, existingLocales: doc.existingLocales };
    }
    case "series-part": {
      const doc = documentData<{ seriesSlug: string }>(data);
      return (
        doc && {
          identity: { kind: "post", slug: doc.slug, seriesSlug: doc.seriesSlug },
          existingLocales: doc.existingLocales,
        }
      );
    }
    default:
      return null;
  }
}
