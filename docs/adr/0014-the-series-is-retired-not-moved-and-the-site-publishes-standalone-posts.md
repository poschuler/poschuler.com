# The Series is retired, not moved, and the site publishes standalone Posts

The site publishes standalone Posts. The Series — the ordered set of Parts, its Sections, its Destination and its landing page — is retired, not moved: its three Parts, its manifest and the Project page that described its codebase are deleted from the content, and nothing on the site serves them. A topic that returns arrives as a new Post at its own address, written for the site as it is then, and **no retired Part redirects to it**. A reader following an old link lands on the ordinary 404.

The decision is about what the site promises. A Series promised an arc to a reader — a Destination stated before the first Part and a reading order across Sections — and a promise that is not going to be kept is worse than none. The cheapest honest answer is to stop making it, and to say here, once, that it was made and withdrawn.

The retirement ships as two Publications, because a Publication is all or nothing (ADR 0003) and a column cannot be dropped in the same deploy as the last code that read it (ADR 0006, amended). The first removes the content, the routes and every module that serves content; the second drops the schema.

## Considered Options

- **Move the Parts to `/blog`.** The obvious one: the three Parts are ordinary Posts in every respect but their Container, so filing them as loose Posts keeps the words and gives the old addresses somewhere to go. Rejected because the words were written for an arc. Each Part leans on the one before it and on a Destination the reader no longer has, so out of the Series it is a chapter of a book that is not on the shelf. Publishing it as a standalone Post would claim a completeness it does not have.

- **Rewrite them.** Turn each Part into a Post that stands alone. Rejected as a cost with no deadline attached: it is writing, not mechanism, and it would hold the removal of a feature hostage to an editorial task whose value is unmeasured. If a topic is worth a Post, it gets written as one, later, and nothing about the retirement stops that.

- **Keep the mechanism dormant for a future Series.** Leave the routes, the model and the arc in place, with no content behind them. Rejected because dormant code is not free and does not stay dormant. It is held to every rule in the pipeline, it is tested and typechecked on every run, and it is read by every person and agent who opens the directory and takes it for a feature the site has. A mechanism that is rebuilt from a record of what it did is rebuilt for the Series that is actually wanted, not for the one that was imagined.

- **Remove the routes but keep the model and the schema.** A smaller change: no address answers, but `series` and `series_section` stay, along with the generators that fill them. Rejected because it removes the only part of the Series a reader could see and keeps everything that costs something to maintain. The model would be a Container nothing can use, and the vocabulary — Series, Section, Destination — would keep describing something the site does not do.

- **A 410 rather than the ordinary 404.** *Gone* is the status that says a document existed and was removed on purpose, and it is the precise one. Rejected because the site has one way of saying an address holds nothing, and a 404 is it. A second status for one family of addresses is a special case in the Worker, in the smoke test and in the next reader's head, to tell a crawler something it learns from a few repeated 404s anyway. The three retired Part addresses and everything under `/series` answer exactly as an address that never existed does.

- **One Publication rather than two.** Remove the content, the code and the schema together. Rejected because the Worker serving the old version still reads the Series tables until the new version is the one serving, so dropping them in the same deploy is a window in which every request that reads them fails. That is the hazard ADR 0006's amendments are about, and it is not one to find out about again on a column that holds an entire kind of content.

## Consequences

- **Retired addresses 404.** `/series`, every address under it, in both Locales, and the three `/blog/pragmatic-nodejs-api-*` addresses the Parts were first published under. They are asserted to answer 404 in the smoke test, written out rather than derived, because there is no longer content to derive them from.

- **The three Part redirects leave the redirect table, and the table's remaining entries stand.** `/resume`, `/resume.pdf` and `/tags/ddd` still point at live pages and keep their permanence. What changes is that the table's rule — *an entry is permanent and has no expiry* — gains one exception, and only one: **an entry leaves when its destination is retired**, because a redirect to a retired address is worse than none. The Part redirects pointed at `/series/…`, which no longer exists.

- **Container is narrowed, not removed.** A Post still belongs to a Project, when it has one, and that still decides the address it is served at. The term stays general so that another kind of Container can join it; what leaves is the first member of that list. ADR 0007's reasoning about the manifest stands for a Project, which keeps its flat `notes:` list.

- **Three declared Tags are carried by nothing.** `express`, `vertical-slices` and `zod` were declared for the Parts and are used by no remaining document. They stay in the vocabulary, because a Tag is declared by the subject and not by what currently carries it, and a Tag no Post carries has no page and is absent from the index (ADR 0008). They are the vocabulary's record of a subject the site has written about and may again.

- **The schema drop costs a second Publication.** `series` and `series_section`, and the generators and verifiers that fill and check them, remain until it. In the meantime the D1 seed empties both tables, so production stops storing the Series even though the schema still has a place for it. ADRs 0004, 0008, 0009, 0010 and 0012 mention the Series, and those mentions are historical and are left as written.

- **No Part is a promise any longer.** Nothing on the site states a reading order across Posts, and no Post says it is one instalment of several. A Project's Field Notes remain what they were: each stands on its own and is read on its own.
