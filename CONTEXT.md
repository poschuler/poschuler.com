# poschuler.com

The personal site of Paul Osorio Schuler: what he writes, what he reads, and who he is professionally. Everything published here is authored in Markdown, versioned in git, and derived into the runtime stores by a build-time pipeline.

## Language

### Content

**Content Item**:
Anything that appears on the site with a publication date and earns a place in the Timeline. Exactly two kinds exist: a Post or a Bookmark.
_Avoid_: entry, record, item

**Post**:
A long-form article written by Paul and published on the site. Its body lives on this site; nowhere else.
_Avoid_: article, blog post, writing

**Bookmark**:
An external article Paul read and chose to endorse. Only its metadata lives here — the body stays at the Source.
_Avoid_: link, read, favourite

**Timeline**:
The reverse-chronological listing that interleaves Posts and Bookmarks. It is the only place the two kinds appear together. It lives at `/timeline`; it used to be the front page, and the home page now carries a short, Post-only excerpt that is **not** a Timeline — a listing without Bookmarks in it is something else. There is one per Locale, each interleaving that Locale's Posts with **every** Bookmark, because a Bookmark has none.
_Avoid_: feed, stream, activity

**Source**:
The publication or author a Bookmark is credited to. A Post has no Source, because Paul is the source.
_Avoid_: publisher, author, site

**Tag**:
A subject a Content Item is about, drawn from a closed vocabulary declared beside the content in `app/content/tags.json` — a Tag that is not declared fails the build. It is written as its own slug, and that one string is what the front matter carries, what the URL serves and what a chip displays; nothing is derived from anything. Tags describe subject matter, not format — `ddd` is a Tag, `post` is not. And it does not vary by Locale: a Tag is a subject, and subjects have no language — what has a language is what is written about them. A Tag has a page only while some Post carries it, and that page lists Posts and never Bookmarks, which is what keeps the Timeline entry above true.
_Avoid_: category, keyword, topic

**Published At**:
The editorial date a Content Item is presented as belonging to — for a Bookmark, when Paul read it, not when the Source published it. It orders the Timeline. Distinct from when the row happened to be written to a store.
_Avoid_: date, created, posted

**Revision**:
A change to a document Paul has already published, stated in his own words: a date and one line about what a returning reader should know. Revisions are curated, not a record of every edit — only what changes what a reader takes away. They never reorder the Timeline, which Published At alone governs.
_Avoid_: update, changelog, edit, version

**Publication**:
The act that puts a Content Item in front of readers. It is all or nothing: until it has happened completely, the Content Item is not published, however finished its Markdown is and however long it has been merged. Distinct from Published At, which is a date the Content Item carries, not an event. Distinct from Draft, which has not gone through that door at all.
_Avoid_: release, deploy, ship, seed

**Draft**:
A document under `app/content/` marked `draft: true` in its front matter. It is checked exactly like a published document — its type against its placement, its Tags against the vocabulary, its Container against the manifest that lists it — and then produces no row, no payload and no address: absent from the Timeline, every index and the sitemap. Not privacy: the repository is public and its history is permanent, so a Draft is out of the site, not out of view. Publishing is deleting one line.
_Avoid_: unpublished, hidden, private, wip

### Series

**Container**:
What a Post belongs to, and what decides the address it is served at. A Post has at most one — a Series, a Project, or none. It is read from the directory the Markdown sits in, never declared in the front matter.
_Avoid_: parent, group, bucket, collection

**Series**:
An ordered set of Posts that develop one subject across several instalments, divided into Series Sections and governed by a Destination it commits to reaching. It has a Slug and a landing page, but it is not a Content Item: it has no Published At of its own and never appears in the Timeline. It is revised in place as Parts are added, so the only date it carries is the newest date among its Parts.
_Avoid_: course, collection, sequence, track

**Series Section**:
A named stage of a Series — *Fundamentals*, *Persistence*. Not a Content Item, and it has no page of its own: it appears on the landing and as context above a Part. A Section with no Parts is planned and a Section with Parts is in progress; only *complete* is ever declared, because the other two are answered by what the Section holds.
_Avoid_: chapter, module, phase, unit

**Part**:
A Post whose Container is a Series. It is an ordinary Post in every other respect — same Timeline, same tags, same body in the same key space — and it does not know where in the Series it sits: the arc is declared once, in the Series manifest.
_Avoid_: chapter, episode, instalment, entry

**Field Note**:
A Post whose Container is a Project. It is an ordinary Post in every other respect — same Timeline, same Tags, same body in the same key space — served at `/projects/:project/:note`. Unlike a Part, it carries no arc: a Project's manifest declares which notes it holds and in what order, never a Destination or a reading order, so each note stands on its own and is read on its own.
_Avoid_: article, entry, case study, page

**Destination**:
What a Series commits to having built by its end, stated on the landing before any index. **Immutable once the first Part ships.** Everything else about a Series may change — how many Parts, their ordering, the Section boundaries, the pace. This may not: changing it breaks the promise the reader signed up for, and a Series is finished when it reaches its Destination, not when it reaches a number of Parts.
_Avoid_: goal, outcome, endpoint, target

### Identity and language

**Slug**:
The stable, human-readable identifier for a Content Item, used verbatim in its URL. It never changes once published, because changing it breaks every existing link.
_Avoid_: id, permalink, path

**Locale**:
A language a Post is written in, as an IETF-style code drawn from a closed vocabulary — today `en` and `es`. Every document except a Bookmark carries exactly one, and a Bookmark carries none: it is a pointer, and pointers aren't translated. Both halves are checked — an unrecognised Locale fails the build rather than being absorbed into the Slug, and so does a Bookmark that declares one.
_Avoid_: lang, language, i18n

**Translation**:
A Post rendered in one specific Locale. Translations of the same Post share a Slug and are distinguished only by Locale, so `(Slug, Locale)` — not Slug alone — identifies a Post.
_Avoid_: version, variant, localization

**Chrome**:
Everything the interface says *around* a document, as against the document's own words: navigation, page headings, empty states, the 404, the word a listing row uses for a date or a kind, every accessible label. It is not authored and it is not published — it ships with the code rather than through the content pipeline, and unlike a Translation it is never missing in a Locale, because it lives in a catalogue typed so that a missing string fails the build rather than falling back to English. The line between the two decides where a string is written, and it is not always obvious which side something is on: the word *Bookmarks* above a list is the site speaking, while a Post's title, a Project's summary and a page's `og:` copy are the document speaking and stay in the language they were written in.
_Avoid_: copy, labels, strings, UI text, i18n

### Professional profile

**Project**:
Software Paul built and can be judged by, presented as a case study. Like the Resume, it is not a Content Item — no Published At, no place in the Timeline — and it is revised in place rather than published, so its most recent Revision is the only date it carries. It may hold Field Notes, declared in its own manifest and indexed at the foot of its landing.
_Avoid_: work, portfolio item, case, demo

**Project Tier**:
How much weight a Project carries — whether it is the one that earns the interview, one that confirms without deciding, or one that merely exists. It governs how a Project renders and whether it has a page of its own. It is **never** part of a URL: a Project promoted from one Tier to another keeps the address it was published at.
_Avoid_: level, rank, importance, featured

**Resume**:
Paul's structured professional history — roles, education, skills, certificates. It is not a Content Item: it has no Slug, no Published At, and no place in the Timeline. It is revised in place rather than published.
_Avoid_: CV, curriculum, profile, bio
