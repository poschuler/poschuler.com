/**
 * The reconciliation every manifest Container runs against its own tree, and
 * the Container-contradiction check every Draft Container runs against its
 * children.
 *
 * A Series' manifest and a Project's are different shapes — an arc of
 * sections against a flat list — but what they check once a slug is in hand is
 * the same invariant, stated by `series-sql.ts` first: a listed item with no
 * file fails, a file no manifest lists fails, and the same item listed twice
 * fails. 1b (Part 8 of `evolution-plan/14-phase-1b-field-notes.md`) needs the
 * identical check for a Project's notes, so it moved here rather than being
 * copied — a check with two implementations has two chances to drift the day
 * one of them is fixed and the other is not.
 */

/** One slug a manifest lists, and where a duplicate listing would be blamed. */
export interface ManifestEntry {
  slug: string;
  /**
   * A section's Slug, for a Series — so two sections both listing the same
   * Part produce *"in both 'a' and 'b'"*. A Project has no sections, so every
   * entry from one manifest carries the same `where` (the manifest's own
   * path), which collapses the same branch into a plain *"listed twice"*.
   */
  where: string;
}

/** One file found under a Container's folder, ready to be reconciled. */
export interface ManifestFile {
  slug: string;
  /** The folder it sits in — its own name, per the rule in `content-tree.ts`. */
  folder: string;
  relativePath: string;
}

/**
 * Manifest and disk must reconcile: every listed item has a file, and every
 * file under the Container's folder is listed exactly once.
 *
 * `noun` names what is being reconciled in the messages this produces — `Part`
 * or `Field Note` — so a build failure reads like the domain rather than like
 * a generic "item".
 */
export function reconcileManifest(
  relativePath: string,
  entries: ManifestEntry[],
  files: ManifestFile[],
  noun: string,
): string | null {
  const listed = new Map<string, string>();

  for (const entry of entries) {
    const already = listed.get(entry.slug);

    if (already !== undefined) {
      return already === entry.where
        ? `${relativePath} lists the ${noun} '${entry.slug}' twice`
        : `${relativePath} lists the ${noun} '${entry.slug}' in both '${already}' and '${entry.where}' — a ${noun} is listed in one place`;
    }

    listed.set(entry.slug, entry.where);
  }

  const onDisk = new Set(files.map((file) => file.slug));

  for (const slug of listed.keys()) {
    if (!onDisk.has(slug)) {
      return `${relativePath} lists the ${noun} '${slug}', which has no file`;
    }
  }

  for (const file of files) {
    // The rule from `content-tree.ts`: the file named after its folder is that
    // folder. Everything downstream builds the path back from the Slug — the
    // KV generator reads the body from `<slug>/<slug>.<lang>.md` — so a file
    // whose filename and folder disagree is a body nothing can find.
    if (file.folder !== file.slug) {
      return `${file.relativePath} is not named after its folder '${file.folder}' — nothing could find its body from the Slug`;
    }

    if (!listed.has(file.slug)) {
      return `${file.relativePath} is not listed in ${relativePath} — a ${noun} nothing indexes cannot be reached or ordered`;
    }
  }

  return null;
}

/** A file whose own front matter may declare itself a Draft. */
export interface DraftableFile {
  slug: string;
  draft: boolean;
}

/**
 * A Container may be a Draft only while it holds no published content (Part 5
 * of `evolution-plan/14-phase-1b-field-notes.md`). There is no cascade: a
 * drafted Container does not hide its published children, it refuses to
 * coexist with them.
 *
 * `files` here is only ever the files that would otherwise be reconciled
 * against this manifest, so an unlisted or misfiled child has already failed
 * elsewhere by the time this runs.
 */
export function containerContradictionError(
  relativePath: string,
  files: DraftableFile[],
): string | null {
  const published = files.find((file) => !file.draft);

  if (!published) {
    return null;
  }

  return `${relativePath} is a draft, but '${published.slug}' is published — a Post cannot be reached through a Container that is not.`;
}
