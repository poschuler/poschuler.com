import { useEffect, useState } from "react";
import { useLocation } from "react-router";

const pathMappings: { regex: RegExp; clickedFrom: string }[] = [
  { regex: /^\/$/, clickedFrom: "home-page" },
  { regex: /^\/explorar$/, clickedFrom: "explore" },
  {
    regex: /^\/departamento\/[^/]+\/categoria\/[^/]+\/sub-categoria\/[^/]+$/,
    clickedFrom: "sub-category-page",
  },
  {
    regex: /^\/departamento\/[^/]+\/categoria\/[^/]+$/,
    clickedFrom: "category-page",
  },
  { regex: /^\/departamento\/[^/]+$/, clickedFrom: "department-page" },
  { regex: /^\/[^/]+\/p$/, clickedFrom: "product-page" },
  { regex: /^\/buscar$/, clickedFrom: "search-page" },
  { regex: /^\/marca\/[^/]+$/, clickedFrom: "brand-page" },
];

const DEFAULT_CLICKED_FROM = "other";

export function useClickedFrom() {
  const location = useLocation();
  const [clickedFrom, setClickedFrom] = useState<string>("");

  useEffect(() => {
    const path = location.pathname;
    let foundMatch = false;

    for (const mapping of pathMappings) {
      if (mapping.regex.test(path)) {
        setClickedFrom(mapping.clickedFrom);
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      setClickedFrom(DEFAULT_CLICKED_FROM);
    }
  }, [location.pathname]);

  return clickedFrom;
}
