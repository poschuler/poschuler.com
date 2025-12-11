import { useEffect, useState } from "react";

export function useGeolocation() {
  const [location, setLocation] = useState<{
    lat: number | null;
    lon: number | null;
  }>({
    lat: null,
    lon: null,
  });

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setLocation({ lat, lon });
        },
        (error) => {
          console.error("Error fetching geolocation", error);
          setLocation({ lat: null, lon: null });
        }
      );
    }
  }, []);

  return location;
}
