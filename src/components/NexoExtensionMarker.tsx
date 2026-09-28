"use client";

import { useEffect } from "react";
import { NEXO_EXTENSION_ATTR } from "@/lib/nexo-extension";

/** Để tiện ích Chrome nhận diện tab Nexo (không dùng postMessage). */
export function NexoExtensionMarker() {
  useEffect(() => {
    const origin = window.location.origin;
    document.documentElement.setAttribute(NEXO_EXTENSION_ATTR, origin);
    return () => {
      document.documentElement.removeAttribute(NEXO_EXTENSION_ATTR);
    };
  }, []);
  return null;
}
