import type { ShouldRevalidateFunction } from "react-router";

/**
 * React Router revalidates every active loader after a form submission. That is
 * the right default — except for the theme toggle, whose POST would otherwise
 * cost a D1 query or a KV read on every click, to change one class on `<html>`.
 *
 * Narrow on purpose: only the theme endpoint is suppressed, so navigations and
 * any future action still revalidate normally.
 */
export const skipRevalidationOnThemeChange: ShouldRevalidateFunction = ({
  formAction,
  defaultShouldRevalidate,
}) => (formAction === "/set-theme" ? false : defaultShouldRevalidate);
