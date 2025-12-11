import { useFetcher } from "react-router";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { useReferrerSource } from "./use-referrer-source";
import { useFullReferrer } from "./use-full-referrer";
import { useGeolocation } from "./use-geolocation";
import { useDeviceType } from "./use-device-type";
import { useClickedFrom } from "./use-clicked-from";

interface eventObject {
  brandNameSlug: string;
}

export function useHandleLoadBrand(eventObject: eventObject) {
  const fetcher = useFetcher({ key: "not-loading-click-event-fetcher" });
  const csrf = useAuthenticityToken();
  const deviceType = useDeviceType();
  const source = useReferrerSource();
  const referrer = useFullReferrer();
  const { lat, lon } = useGeolocation();
  const clickedFrom = useClickedFrom();

  return function submit() {
    const clickEvent: Record<string, any> = {};

    if (source) {
      clickEvent.source = source;
    }

    if (referrer) {
      clickEvent.referrer = referrer;
    }
    if (deviceType) {
      clickEvent.deviceType = deviceType;
    }
    if (lat && lon) {
      clickEvent.location = {
        geo: { lat, lon },
      };
    }

    if (eventObject.brandNameSlug) {
      clickEvent.brandNameSlug = eventObject.brandNameSlug;
    }

    fetcher.submit(
      { intent: "save", csrf, ...clickEvent },
      { action: "/api/click-event", method: "post" }
    );
  };
}
