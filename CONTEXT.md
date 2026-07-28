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
The single reverse-chronological listing on the home page that interleaves Posts and Bookmarks. It is the site's front page and the only place the two kinds appear together.
_Avoid_: feed, stream, activity

**Source**:
The publication or author a Bookmark is credited to. A Post has no Source, because Paul is the source.
_Avoid_: publisher, author, site

**Tag**:
A topic label attached to a Content Item. Tags describe subject matter, not format — `ddd` is a Tag, `post` is not.
_Avoid_: category, keyword, topic

**Published At**:
The editorial date a Content Item is presented as belonging to — for a Bookmark, when Paul read it, not when the Source published it. It orders the Timeline. Distinct from when the row happened to be written to a store.
_Avoid_: date, created, posted

**Publication**:
The act that puts a Content Item in front of readers. It is all or nothing: until it has happened completely, the Content Item is not published, however finished its Markdown is and however long it has been merged. Distinct from Published At, which is a date the Content Item carries, not an event.
_Avoid_: release, deploy, ship, seed

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

**Resume**:
Paul's structured professional history — roles, education, skills, certificates. It is not a Content Item: it has no Slug, no Published At, and no place in the Timeline. It is revised in place rather than published.
_Avoid_: CV, curriculum, profile, bio
