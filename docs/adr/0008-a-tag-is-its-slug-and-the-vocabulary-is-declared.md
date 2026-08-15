# A Tag is its Slug, and the vocabulary is declared

The front matter carries the canonical slug. That same string is the URL the Tag is served at and the label a chip displays, with nothing derived in between. And the set of Tags this site may use is declared in one file beside the content — `app/content/tags.json`, a flat alphabetical array of slugs — so a Tag that is not in it fails the build.

Two checks, because they are two different mistakes, and the message the generator fails with says which one was made:

```
blog/…/persistence-and-repositories.en.md carries the Tag "Node.js", which is
not a slug — a Tag is written in lower-case kebab-case, and that same string is
its URL

blog/…/persistence-and-repositories.en.md carries the Tag 'domain-driven-design',
which app/content/tags.json does not declare — declare it there, or use the Tag
this site already has for that subject
```

**This ADR is needed for a reason beyond the usual one.** Everywhere else in this repository a declaration carries its reasoning beside it: `schema.sql` explains why `updates` is distinct from `updated_at`, `CONTENT_TREES` explains why `projects` nests nothing, `routes.ts` explains why an index of one entry exists. `tags.json` is JSON, JSON has no comments, and a bare array of twenty-two strings cannot say why it has to be edited before a Post can be written about a new subject. Without this file the next reader meets a list with no author.

## What it is for

Every Post and Bookmark carried Tags for two years while nothing read them, and three defects accumulated in plain sight: one Post writing `nodejs` against three writing `Nodejs`; a November Post carrying `architecture` against a February one carrying `Software Architecture`; and multi-word labels with spaces, which have no defined URL at all. None of them was visible, because a value nobody reads cannot be wrong.

The first and the third are questions of **form**, and the slug rule answers them. The second is not: `architecture` and `software-architecture` are both well-formed slugs, as are `value-object` and `value-objects`, and `ddd` and `domain-driven-design`. Only a declared set catches a second word for a subject that already has one, which is why there are two rules here rather than one.

## Considered Options

- **A display label in the front matter, with the URL derived by `slugify()`.** The conventional arrangement, and the one that would let a chip read *Software Architecture*. Rejected on what it does to the collision above: `'Nodejs'` and `'Node.js'` both slugify to `nodejs`, both succeed, both address the same page, and nothing reports that two labels now name one thing. The collision becomes **invisible** rather than impossible — the same failure this decision exists to remove, wearing a different hat. It also needs either a label→slug map, which is a second source of truth for twenty-two strings, fifteen of which appear exactly once, or an accepted inability to ever render `C#`, because `slugify` is not invertible.
- **The slug rule alone, with any well-formed slug accepted.** Cheap, and it catches two of the three defects. Rejected because the one it does not catch is the one that was already published: two words for one subject, each with its own page holding one Post, and a reader on either of them told this site has written about it once.
- **A warning rather than a failed build.** Rejected on how this repository already behaves — `check:fixtures` compares regenerated payloads byte for byte, the Series checks stop the build — and on the specific fact that the generator prints `Skipping:` lines on every successful run. A warning in that stream is a warning nobody reads.
- **The vocabulary as a constant in the pipeline**, in TypeScript, where `as const` would give it a type and autocompletion. Rejected because which subjects this site writes about is an editorial decision about content, not a parameter of a generator: ADR 0004's arrangement is that declarations sit next to what they describe and `seed/` is the thing that reads them. YAML would have put it closer still, but no YAML parser is a direct dependency here — `front-matter` bundles one and does not expose it — so a ten-line file would have cost a dependency. JSON needs `JSON.parse`, and `app/routes/resume/resume.json` is the precedent for structured data beside the code that reads it.
- **A declared vocabulary, checked at build time, written as slugs.** Chosen. It is the third time this repository has taken this shape, after the Series manifest whose sections a Part must resolve against (ADR 0007) and the `CHECK` that fixes a Project's `tier` to three values.

## Consequences

- **A chip reads `software-architecture`, not *Software Architecture*.** That is a real and visible cost, paid on every Post and every Tag page, and it is what buys the collision being impossible rather than invisible. It is also the convention of every place a reader has met a tag before — dev.to, GitHub topics, npm keywords — so it is legible where it is not pretty. The day it is worth undoing, the cost of undoing it is the map this decision refused to write.
- **Two messages, because there are two mistakes.** *Not a slug* and *not declared* are told apart deliberately: an author who is told `'Nodejs'` is undeclared will declare it, which is the wrong repair for a casing mistake. Each message names the file, the offending Tag and `app/content/tags.json`, so fixing it needs no investigation.
- **The vocabulary covers Bookmarks as well as Posts**, although no Tag page lists a Bookmark. Twelve of the twenty-two declared Tags sit on Bookmarks alone, and leaving them unchecked would mean twelve slugs nobody has looked at in two years on the day the Bookmark question is reopened.
- **What is declared is not what exists.** `tags.json` says what may be written; `content_tag` says what is written. `/tags` lists only the Tags some Post carries, and a Tag no Post carries is a 404 rather than an empty page — so `/tags/webdev` does not exist today and begins to exist, with nothing declared anywhere, the first time a Post carries it.
- **A Tag page lists Posts and never Bookmarks**, which is what keeps `CONTEXT.md`'s Timeline entry true: the Timeline is *the only place the two kinds appear together*, strictly enough that the same entry insists the home page excerpt is not a Timeline. That sentence was checked against this phase rather than left to survive by luck, and it needed no rewriting. The rejected middle option — Posts anchor the page, Bookmarks in their own section below — stays available without a migration, because the table holds rows for both kinds.
- **Adding a subject is a deliberate edit**, and renaming one needs no redirect. A Tag page is `noindex, follow` and its address is not a URL this site published as content, so `app/lib/redirects.ts` stays a record of published addresses rather than a log of every time a word was changed.
- **Reading `tags.json` from disk is not covered by the suite**, consistently with the rest of the pipeline: the rules are a pure module and are tested against a vocabulary passed in as a value, while the file read lives in the disk-touching generator that no test here claims to exercise. A malformed or duplicate-bearing vocabulary is a checked failure of the parser, not of the reader.
- **The declaration is not a fifth content tree.** `CONTENT_TREES` maps a tree to the Content Item type it produces, and a vocabulary produces none. It sits loose at the root of `app/content/`, which trips nothing: the walker's unclaimed-directory check filters directory names, and a Tag missing from the file fails the build anyway — the check is the visibility.
