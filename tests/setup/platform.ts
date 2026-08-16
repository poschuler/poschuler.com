import { RouterContextProvider } from "react-router";
import { getPlatformProxy } from "wrangler";

import { cloudflareContext, deriveLocale, localeContext, type AppEnv } from "~/context";

/**
 * Where the test stores live.
 *
 * Separate from `.wrangler/state/v3`, which `wrangler --local` and the smoke
 * test share, so running the suite never disturbs what a developer has seeded
 * locally. The `/v3` suffix is not decoration: the wrangler CLI appends it to
 * whatever `--persist-to` receives, while `getPlatformProxy` takes the path
 * verbatim. Both have to end up pointing at the same directory.
 */
export const TEST_PERSIST_DIR = ".wrangler/state-test";
export const TEST_PERSIST_PATH = `${TEST_PERSIST_DIR}/v3`;

export type TestPlatform = {
  env: AppEnv;
  ctx: ExecutionContext;
  dispose: () => Promise<void>;
};

/**
 * Real D1 and KV, from Miniflare, reading the bindings out of `wrangler.jsonc`.
 *
 * Not a mock of the data layer — the queries in `content.server.ts` run against
 * actual SQLite, so a partial unique index or a `CHECK` constraint behaves here
 * exactly as it does at the edge.
 *
 * The caller owns `dispose`: leaving a proxy open keeps workerd alive and the
 * test process never exits.
 */
export async function openTestPlatform(): Promise<TestPlatform> {
  const { env, ctx, dispose } = await getPlatformProxy<AppEnv>({
    persist: { path: TEST_PERSIST_PATH },
  });

  return { env, ctx: ctx as unknown as ExecutionContext, dispose };
}

/**
 * The request-scoped context a loader expects, built the same way
 * `workers/app.ts` builds it — React Router v8 reads bindings through
 * `context.get(cloudflareContext)`, not off a plain object.
 *
 * The Locale comes from `deriveLocale`, the same function `workers/app.ts`
 * calls, so a loader test exercises the real derivation rather than a stand-in
 * for it. Every existing test requests a root path, which `deriveLocale` reads
 * as `en` — the same Locale those tests already assumed.
 *
 * Takes the already-parsed `url` rather than the `Request` it came from: the
 * one caller, `routeArgs`, has already parsed it for `pattern`, and parsing it
 * again here would be the same "derive from the path more than once" mistake
 * `deriveLocale`'s own doc comment warns against.
 */
export function testContext(
  { env, ctx }: Pick<TestPlatform, "env" | "ctx">,
  url: URL,
): RouterContextProvider {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx });
  context.set(localeContext, deriveLocale(url));

  return context;
}

/**
 * The full argument object a loader or action receives.
 *
 * React Router v8 passes `url` and `pattern` alongside `request`, and the
 * generated `Route.LoaderArgs` of a typed route carries more still (`matches`).
 * Building it here means one cast, in one place, with a reason next to it —
 * rather than an `as never` at every call site, which would silence real type
 * errors in the tests along with this one.
 */
export function routeArgs<Args>(
  platform: Pick<TestPlatform, "env" | "ctx">,
  request: Request,
  params: Record<string, string> = {},
): Args {
  const url = new URL(request.url);

  return {
    request,
    url,
    pattern: url.pathname,
    params,
    context: testContext(platform, url),
  } as Args;
}

/** The same platform with one binding or var replaced. */
export function platformWith(
  platform: Pick<TestPlatform, "env" | "ctx">,
  overrides: Partial<Record<keyof AppEnv, unknown>>,
): Pick<TestPlatform, "env" | "ctx"> {
  return { env: { ...platform.env, ...overrides } as AppEnv, ctx: platform.ctx };
}
