import { useFetcher, useNavigate } from "react-router";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { useReferrerSource } from "./use-referrer-source";
import { useFullReferrer } from "./use-full-referrer";
import { useGeolocation } from "./use-geolocation";
import { useDeviceType } from "./use-device-type";
import { useClickedFrom } from "./use-clicked-from";

interface eventObject {
  productNameSlug: string;
  brandNameSlug: string;
  departmentNameSlug: string;
  categoryNameSlug: string;
  subCategoryNameSlug: string;
}

export function useHandleClickProduct(
  eventObject: eventObject,
  _clickedFrom: string | null = null
) {
  const fetcher = useFetcher({ key: "not-loading-click-event-fetcher" });
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

    if (eventObject.productNameSlug) {
      clickEvent.productNameSlug = eventObject.productNameSlug;
    }

    if (eventObject.brandNameSlug) {
      clickEvent.brandNameSlug = eventObject.brandNameSlug;
    }

    if (eventObject.departmentNameSlug) {
      clickEvent.departmentNameSlug = eventObject.departmentNameSlug;
    }

    if (eventObject.categoryNameSlug) {
      clickEvent.categoryNameSlug = eventObject.categoryNameSlug;
    }

    if (eventObject.subCategoryNameSlug) {
      clickEvent.subCategoryNameSlug = eventObject.subCategoryNameSlug;
    }

    fetcher.submit(
      { intent: "save", csrf, ...clickEvent },
      { action: "/api/click-event", method: "post" }
    );

    navigate(`/${eventObject.productNameSlug}/p`);
  };
}
