import { useEffect, useState } from "react";
import { UAParser } from "ua-parser-js";

export function useDeviceType() {
  const [deviceType, setDeviceType] = useState<
    "mobile" | "tablet" | "desktop" | null
  >(null);

  useEffect(() => {
    const parser = new UAParser();
    const type = parser.getDevice().type;
    if (type === "mobile") setDeviceType("mobile");
    else if (type === "tablet") setDeviceType("tablet");
    else setDeviceType("desktop");
  }, []);

  return deviceType;
}
