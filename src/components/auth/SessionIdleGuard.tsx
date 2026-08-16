"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SESSION_IDLE_MS } from "@/lib/session-policy";

/**
 * Hết 30 phút không tương tác trên tab → đăng xuất (kèm audit phía server).
 * Middleware cũng cắt phiên idle; component này bắt trường hợp user để tab mở không điều hướng.
 */
export function SessionIdleGuard() {
  const router = useRouter();
  const lastActiveRef = useRef(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    lastActiveRef.current = Date.now();

    function markActive() {
      if (document.visibilityState === "hidden") return;
      lastActiveRef.current = Date.now();
    }

    const windowEvents = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"] as const;
    for (const event of windowEvents) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", markActive);

    const timer = window.setInterval(() => {
      if (loggingOutRef.current) return;
      if (Date.now() - lastActiveRef.current < SESSION_IDLE_MS) return;
      loggingOutRef.current = true;
      void fetch("/api/auth/session-timeout", {
        method: "POST",
        credentials: "same-origin",
      }).finally(() => {
        router.replace("/login?reason=idle");
      });
    }, 15_000);

    return () => {
      for (const event of windowEvents) {
        window.removeEventListener(event, markActive);
      }
      document.removeEventListener("visibilitychange", markActive);
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
