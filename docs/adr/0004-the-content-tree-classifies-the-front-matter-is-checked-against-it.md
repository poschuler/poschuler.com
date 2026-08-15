# The content tree classifies; the front matter is checked against it

A Markdown file's kind is decided by which tree it sits in — `app/content/blog/`, `bookmarks/`, `projects/`, later `series/` — and each generator walks only its own tree. The `type` field in the front matter stays, but it is no longer what classifies: it is compared against the tree, and a mismatch fails the build.

This replaces an arrangement where the two generators answered the question differently. `generate-seed-sql.ts` walked all of `app/content` recursively and classified by `attributes.type`, so the directory was decorative. `generate-kv-json.ts` walked only `app/content/blog` and never looked further, so there the directory was the whole rule. Neither was wrong on its own; together they let a Post moved into `bookmarks/` be seeded by D1 — the front matter still said `post` — while KV rendered no body for it. The Post listed, linked and appeared in the sitemap with an empty page, and nothing failed.

## Considered Options

- **Front matter alone, made consistent.** Teach the KV generator to walk everything and filter by `type`, matching D1. Rejected: it keeps the directory meaningless, so the misfiled file stays legal, and it makes every new kind noisy — a `type: 'project'` the content generator does not recognise produces `- Skipping: … declares no recognised type` on every run. That warning is the one signal that catches a malformed file; turning it into expected output is how a real one gets read past.
- **Directory alone, dropping `type`.** The directory already implies the kind, so the field is redundant. Rejected on cost and on safety: removing it means editing every existing content file, and a misfiled document still passes silently — it is simply processed as whatever its new neighbours are, which is the failure above with a different cause.
- **Directory classifies, front matter validates.** Chosen. It costs nothing in existing files, keeps the warning meaningful, and converts a silent mismatch into a red build.

## Amendment (Phase 2a): depth classifies inside a tree

The rule above assumed one tree holds one kind of file. `series/` breaks that: it holds the manifest that describes a Series *and* the Posts that are its Parts. The rule is generalised rather than replaced — what tells the two apart is already in the path, and it is how deep the file sits.

```
bookmarks/how-i-would-do-auth.md                   depth 1
blog/<slug>/<slug>.en.md                           depth 2
projects/<project>/<project>.en.md                 depth 2
series/<series>/<series>.en.md                     depth 2      the Series
series/<series>/<part>/<part>.en.md                depth 3      a Part of it
```

The reading is one sentence: **the file named after its folder *is* that folder, and a subfolder is content living inside it.** So depth 1 and 2 are the tree's own item, and depth 3 is content whose Container is the folder above. `CONTENT_TREES` says per tree what may nest — `series` accepts a nested `post`, and `blog`, `bookmarks` and `projects` accept nothing, so a subfolder under `blog/` fails the build rather than acquiring an invented meaning.

`projects: { nested: null }` is the interesting one, because a Field Note is exactly a nested Post and is not accepted. It needs a `project_slug` on `content` to be linkable, and that column arrives in 1b. Accepting one today would seed a Post with no Container — the silent shape this ADR exists to remove.

This is also what makes the Container derivable at all. The directory a Part sits in names its Series, so nothing has to be told twice: the Container is read from the path, and ADR 0007 keeps the *arc* in one manifest rather than in each Part's front matter.

## Consequences

- **`contentRowFor` takes a path, not a filename.** It was `contentRowFor(filename, attributes)`, deriving identity from the basename alone; it now receives the path relative to `app/content`. `seed-sql.test.ts` is rewritten with it. Path separators are normalised before any comparison, so the rule does not depend on the platform the generator runs on.
- **Identity and containment become two separate readings of the same path.** The filename gives the Slug — unchanged, `<slug>.<locale>.md` — and the directory gives what the file belongs to. Before this, the directory a Post sat in was read by nobody, which is why the published Series parts carry their series name written by hand inside their own Slug.
- **This is what a container needs.** A Field Note's Project, and a Series part's Series, are its parent directory. A generator that classified by front matter would have to be told the container a second time, in the file, with nothing keeping the two in step.
- **A new kind of content is a new directory plus a branch, not a new global filter.** Each generator's blast radius is its own tree.
- **The check is only as good as the trees it knows.** A file under a directory no generator claims is not misclassified — it is invisible. The generators fail the build on an unrecognised top-level directory for that reason; a silent nothing is the failure mode this ADR exists to remove.
