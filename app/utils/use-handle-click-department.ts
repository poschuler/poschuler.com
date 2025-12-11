import { useFetcher, useNavigate } from "react-router";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { useReferrerSource } from "./use-referrer-source";
import { useFullReferrer } from "./use-full-referrer";
import { useGeolocation } from "./use-geolocation";
import { useDeviceType } from "./use-device-type";
import { useClickedFrom } from "./use-clicked-from";

interface eventObject {
  departmentNameSlug: string;
}

export function useHandleClickDepartment(
  eventObject: eventObject,
  _clickedFrom: string | null = null
) {
  const fetcher = useFetcher({ key: "not-loading-handle-click-brand-fetcher" });
  const csrf = useAuthenticityToken();
  const deviceType = useDeviceType();
  const source = useReferrerSource();
  const referrer = useFullReferrer();
  const { lat, lon } = useGeolocation();
  const clickedFrom = useClickedFrom();
  const navigate = useNavigate();

  return function submit() {
    const clickEvent: Record<string, any> = {
      clickedFrom: _clickedFrom ?? clickedFrom,
    };

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

    if (eventObject.departmentNameSlug) {
      clickEvent.departmentNameSlug = eventObject.departmentNameSlug;
    }

    fetcher.submit(
      { intent: "save", csrf, ...clickEvent },
      { action: "/api/click-event", method: "post" }
    );

    navigate(`/departamento/${eventObject.departmentNameSlug}`);
  };
}
