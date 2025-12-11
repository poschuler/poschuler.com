import { useEffect, useState } from "react";

export function useReferrerSource() {
  const [referrerSource, setReferrerSource] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const currentHost = window.location.host;
    const referrerUrl = document.referrer;

    if (!referrerUrl) {
      setReferrerSource("internal");
      return;
    }

    try {
      const referrerHost = new URL(referrerUrl).host;

      if (referrerHost === currentHost) {
        setReferrerSource("internal");
      } else {
        setReferrerSource(referrerHost.replace(/^www\./, ""));
      }
    } catch (e) {
      setReferrerSource("internal");
    }
  }, []);

  return referrerSource;
}
