import { useEffect, useState } from "react";

export function useFullReferrer() {
  const [fullReferrer, setFullReferrer] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const referrerUrl = document.referrer;

    if (!referrerUrl) {
      setFullReferrer(null); // No referrer
    } else {
      setFullReferrer(referrerUrl); // Return full referrer URL
    }
  }, []);

  return fullReferrer;
}
