export function isRunningOnServer() {
  return typeof document === "undefined";
}
