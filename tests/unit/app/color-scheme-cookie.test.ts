import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "~/context";
import { getColorScheme, setColorScheme } from "~/color-scheme-cookie";

/**
 * This module took the site down once, and the shape of the fix is an
 * asymmetry that is easy to "tidy up" by accident: reading degrades to the
 * default theme, writing throws. Both halves are asserted here, along with the
 * `__Host-` prefix that forbids the `Domain` attribute.
 *
 * `scripts/smoke-test.sh` covers the same outage from the outside — that a
 * failing toggle does not spread to the rest of the site. These are the unit
 * of behaviour underneath it.
 */

const env = (secret?: string) => ({ SESSION_THEME_SECRET: secret } as AppEnv);

const requestWith = (cookie?: string) =>
  new Request("https://poschuler.com/", {
    headers: cookie ? { Cookie: cookie } : {},
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reading degrades", () => {
  it("falls back to system when the signing secret is missing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getColorScheme(requestWith(), env())).resolves.toBe("system");

    // A misconfigured Worker still serves every page — and says so.
    expect(logged).toHaveBeenCalled();
  });

  it("falls back to system when no cookie is sent", async () => {
    await expect(getColorScheme(requestWith(), env("a-secret"))).resolves.toBe("system");
  });

  it("falls back to system when the cookie is not signed by this secret", async () => {
    const forged = await setColorScheme("dark", env("someone-elses-secret"));
    const value = forged.split(";")[0];

    await expect(getColorScheme(requestWith(value), env("a-secret"))).resolves.toBe("system");
  });

  it("falls back to system when the cookie holds a value outside the schema", async () => {
    await expect(
      getColorScheme(requestWith("__Host-poschuler-color-scheme=neon"), env("a-secret")),
    ).resolves.toBe("system");
  });

  it.each(["dark", "light", "system"] as const)("round-trips %s", async (scheme) => {
    const header = await setColorScheme(scheme, env("a-secret"));
    const value = header.split(";")[0];

    await expect(getColorScheme(requestWith(value), env("a-secret"))).resolves.toBe(scheme);
  });
});

describe("writing does not degrade", () => {
  /**
   * A cookie signed with a placeholder is worse than a toggle that visibly
   * fails: the failure stays confined to `/set-theme`, and every other route is
   * unaffected.
   */
  it("throws when the signing secret is missing", async () => {
    await expect(setColorScheme("dark", env())).rejects.toThrow("SESSION_THEME_SECRET");
  });
});

describe("the cookie cannot gain a second scope", () => {
  /**
   * The predecessor was emitted host-only while `DEPLOYMENT_ENV` was unset and
   * gained `Domain=poschuler.com` the day that var was deployed. A browser
   * treats those as two different cookies of the same name, sends both, and the
   * first one wins — so every returning visitor had their theme frozen while
   * each click wrote the new value somewhere nothing would read it.
   *
   * `__Host-` makes that unrepresentable: a browser rejects the cookie outright
   * if it carries a `Domain`.
   */
  it("carries the __Host- prefix, Secure and Path=/, and no Domain", async () => {
    const header = await setColorScheme("dark", env("a-secret"));

    expect(header).toMatch(/^__Host-poschuler-color-scheme=/);
    expect(header).toMatch(/;\s*Secure/i);
    expect(header).toMatch(/;\s*Path=\/(?:;|$)/i);
    expect(header).not.toMatch(/;\s*Domain=/i);
  });

  it("stays HttpOnly and SameSite=Lax", async () => {
    const header = await setColorScheme("dark", env("a-secret"));

    expect(header).toMatch(/;\s*HttpOnly/i);
    expect(header).toMatch(/;\s*SameSite=Lax/i);
  });
});
