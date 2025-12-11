import { useRouteLoaderData } from "react-router";

export function useBaseUrl(): string | null {
  const data = useRouteLoaderData("root");
  if (!data) {
    return "";
  }
  return data.baseUrl;
}
