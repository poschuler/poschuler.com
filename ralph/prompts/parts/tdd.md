<!--
Adapted from mattpocock/skills (https://github.com/mattpocock/skills) — MIT
licence, © 2026 Matt Pocock. The anti-patterns and the rules of the loop are
close to the original; the seam section is rewritten, because the original
confirms seams with a human and this session has none.
-->

## Testing, and where the tests go

TDD here is the red → green loop, and the point of the loop is tests worth
keeping.

**A good test verifies behaviour through a public interface, never an
implementation detail.** Code can change entirely; the test shouldn't. A good
test reads like a specification — "a Draft is not served at its public
address" tells you what capability exists — and survives a refactor because it
doesn't care about internal structure. Name tests in the vocabulary of
`CONTEXT.md`, so the suite speaks the same language as the domain.

**A seam is the public boundary you test at**: the interface where behaviour is
observable without reaching inside. Tests live at seams, never against
internals.

**Test only at seams that were agreed before you started.** In this session that
means, in order:

1. The seams the ticket itself names. Those are agreed by definition — the
   ticket is the agreement.
2. Failing that, the seams this repo already tests. Read `tests/` and follow the
   boundary it treats as public for the area you are touching.

If neither settles it, do not invent a testing regime for the codebase: test the
narrowest public boundary that proves the ticket's acceptance criteria, and say
in your closing comment which seam you chose and why. Choosing a seam nobody
agreed is how a suite grows tests that break on every refactor.

## Anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behaviour hasn't changed.
- **Tautological** — the assertion recomputes the expected value the way the code does, so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth — a known-good literal, a worked example, the ticket.
- **Horizontal slicing** — writing all the tests first, then all the implementation. Bulk tests verify *imagined* behaviour: they test the shape of things rather than what a user sees, and they commit you to a test structure before you understand the implementation. Work in vertical slices instead — one test → one implementation → repeat.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to
  pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per
  cycle.
- **Refactoring is not part of the loop.** It belongs to the review, which is a
  separate session — not to this one.
