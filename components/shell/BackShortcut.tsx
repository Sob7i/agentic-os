"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * ⌘1 back to the Board, from anywhere (AC-7).
 *
 * The only client component in the shell (§5.7). Everything else stays
 * server-rendered so D8's "on load plus a manual refresh" is unchanged — a
 * reload must keep re-running the collectors exactly as it does today.
 */
export function BackShortcut() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
