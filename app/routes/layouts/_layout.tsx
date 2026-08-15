import { Outlet } from "react-router";
import { Footer } from "./footer";
import { Header } from "./header";

/**
 * The shell every page shares: header, page, footer.
 *
 * **The page's height is settled here, not by each route.** `min-h-screen` on
 * the column plus `flex-1` on a route's `<main>` makes the page fill the
 * viewport whatever the header and footer measure. Nine routes used to subtract
 * the header's height from `100vh` themselves instead — the same arithmetic
 * written out nine times, hard-coding a number that belongs to a component
 * none of them render, and all nine wrong the moment a footer existed. They
 * did it through Tailwind's `theme()`, which v4 keeps for compatibility and
 * which no new code should reach for.
 */
export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}
