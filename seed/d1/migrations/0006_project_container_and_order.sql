-- Phase 1b, expand half: the Project Container column arrives, and a rename
-- that cannot be atomic takes its first step.
--
-- No `IF NOT EXISTS`, following 0002 through 0005: this runs exactly once
-- against a database that has neither column, and a statement that quietly
-- does nothing is the failure mode being designed out.

-- The Container, when it is a Project rather than a Series. Written by the
-- generator from a Project's `notes:` manifest, same as `series_slug` is
-- written from a Series' — and never present in front matter, for the same
-- reason: a Field Note does not know where it is, the manifest says (ADR
-- 0007). Nothing writes it yet; the walker and generator that read a
-- Project's manifest are a later ticket. It lands here anyway because this is
-- the phase's one schema-changing migration — see the field notes.
ALTER TABLE content ADD COLUMN project_slug TEXT;

-- `container_order` — the position its Container's list gave a Part or a
-- Field Note. It replaces `section_order`, which meant that on this table and
-- something else on `series_section` below: a section's position within the
-- arc, not a Part's position within its section. One name meaning two things
-- is the collision this rename closes.
--
-- The rename is an expand-and-contract, not one statement, and for the reason
-- `0004` through `0005` already established for `content.tags`: the publish
-- job applies migrations before it deploys the Worker (ADR 0006's amendment),
-- so the previously deployed Worker is still asking for `c.section_order`
-- while this migration runs. Renaming the column out from under it would
-- answer `no such column` on the Series landing and every Part through the
-- seed, the build and the deploy.
--
-- So `container_order` arrives as a NEW column, `section_order` stays, and
-- the generator writes both with the same value. The Worker deployed in this
-- same publication reads `container_order` — the switch happens in the same
-- deploy as the column arriving, unlike `content.tags`, which needed a
-- publication of its own for that step (`e62bff5`) because it had not
-- switched in its expand step. `section_order` is dropped once this
-- publication is confirmed live, in a migration of its own — the contract
-- half, gated on that confirmation.
ALTER TABLE content ADD COLUMN container_order INTEGER;
