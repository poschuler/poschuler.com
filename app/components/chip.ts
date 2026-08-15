/**
 * The site's chip: a short fact set off from the text around it by a border.
 *
 * Not a component, because the six places that render one render three
 * different elements — `<li>` inside a list of them, `<span>` beside a
 * heading, `<p>` inside an article — and a wrapper whose only job is to pick
 * the tag names nothing the tag does not already name. What the six had in
 * common was never the element. It was these nine classes.
 *
 * It was written out six times, and by the time it was collected two copies
 * carried a font that the `<main>` above them already set and two had gone to
 * an arbitrary 10px small enough to stop being readable. Only the second was
 * ever noticed, and only because it looked wrong.
 *
 * **A chip wraps.** Two of the six pinned their text to a single line, and
 * collecting that into here broke the Resume: the longest chip on the site is
 * `English — Professional working proficiency` at roughly 280px, and it sits
 * in the hero's text column, which a 112px portrait and a 16px gap leave at
 * about 200px on a phone. The two that pinned it hold `Lima, Peru` and a list
 * of certificate keywords — short enough that they would never have wrapped
 * anyway, so the class did nothing where it was and overflowed where it was
 * copied to. A chip is a fact set off from the text, not a fact that must fit
 * on one line.
 *
 * The border is the whole idea. This site marks a division with a line, never
 * with a fill: the pages a chip appears on are already a step up the neutral
 * scale, so a filled chip on one reads as recessed into the page rather than
 * as a label sitting on top of it.
 *
 * Compose position and context at the call site — `cn(chip, "not-prose mb-4")`
 * — and keep this string to what every chip is.
 */
export const chip =
  "inline-flex items-center rounded-md border border-default px-2 py-0.5 font-semibold text-low text-xs";
