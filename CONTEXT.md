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
The single reverse-chronological listing that interleaves Posts and Bookmarks. It is the only place the two kinds appear together. It lives at `/timeline`; it used to be the front page, and the home page now carries a short, Post-only excerpt that is **not** a Timeline — a listing without Bookmarks in it is something else.
_Avoid_: feed, stream, activity

**Source**:
The publication or author a Bookmark is credited to. A Post has no Source, because Paul is the source.
_Avoid_: publisher, author, site

**Tag**:
A subject a Content Item is about, drawn from a closed vocabulary declared beside the content in `app/content/tags.json` — a Tag that is not declared fails the build. It is written as its own slug, and that one string is what the front matter carries, what the URL serves and what a chip displays; nothing is derived from anything. Tags describe subject matter, not format — `ddd` is a Tag, `post` is not. A Tag has a page only while some Post carries it, and that page lists Posts and never Bookmarks, which is what keeps the Timeline entry above true.
_Avoid_: category, keyword, topic

**Published At**:
The editorial date a Content Item is presented as belonging to — for a Bookmark, when Paul read it, not when the Source published it. It orders the Timeline. Distinct from when the row happened to be written to a store.
_Avoid_: date, created, posted

**Revision**:
A change to a document Paul has already published, stated in his own words: a date and one line about what a returning reader should know. Revisions are curated, not a record of every edit — only what changes what a reader takes away. They never reorder the Timeline, which Published At alone governs.
_Avoid_: update, changelog, edit, version

**Publication**:
The act that puts a Content Item in front of readers. It is all or nothing: until it has happened completely, the Content Item is not published, however finished its Markdown is and however long it has been merged. Distinct from Published At, which is a date the Content Item carries, not an event.
_Avoid_: release, deploy, ship, seed

### Series

**Container**:
What a Post belongs to, and what decides the address it is served at. A Post has at most one — today a Series, or none. It is read from the directory the Markdown sits in, never declared in the front matter.
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

**Destination**:
What a Series commits to having built by its end, stated on the landing before any index. **Immutable once the first Part ships.** Everything else about a Series may change — how many Parts, their ordering, the Section boundaries, the pace. This may not: changing it breaks the promise the reader signed up for, and a Series is finished when it reaches its Destination, not when it reaches a number of Parts.
_Avoid_: goal, outcome, endpoint, target

### Identity and language

**Slug**:
The stable, human-readable identifier for a Content Item, used verbatim in its URL. It never changes once published, because changing it breaks every existing link.
_Avoid_: id, permalink, path

**Locale**:
A language a Post is written in, as an IETF-style code (`en`, `es`). A Bookmark has no Locale — it is a pointer, and pointers aren't translated.
_Avoid_: lang, language, i18n

**Translation**:
A Post rendered in one specific Locale. Translations of the same Post share a Slug and are distinguished only by Locale, so `(Slug, Locale)` — not Slug alone — identifies a Post.
_Avoid_: version, variant, localization

### Professional profile

**Project**:
Software Paul built and can be judged by, presented as a case study. Like the Resume, it is not a Content Item — no Published At, no place in the Timeline — and it is revised in place rather than published, so its most recent Revision is the only date it carries.
_Avoid_: work, portfolio item, case, demo

**Project Tier**:
How much weight a Project carries — whether it is the one that earns the interview, one that confirms without deciding, or one that merely exists. It governs how a Project renders and whether it has a page of its own. It is **never** part of a URL: a Project promoted from one Tier to another keeps the address it was published at.
_Avoid_: level, rank, importance, featured

**Resume**:
Paul's structured professional history — roles, education, skills, certificates. It is not a Content Item: it has no Slug, no Published At, and no place in the Timeline. It is revised in place rather than published.
_Avoid_: CV, curriculum, profile, bio
