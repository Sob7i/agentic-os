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
      if (e.key !== "1" || !(e.metaKey || e.ctrlKey)) return;
      // Never steal the key from someone who is typing. There is no editable
      // surface in the shell today; the inbox and the create-task form arrive in
      // Stage 3, and a global handler that predates them would be found by a user
      // rather than by a test.
      const el = e.target as HTMLElement | null;
      if (
        el?.isContentEditable ||
        (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
      ) {
        return;
      }
      e.preventDefault();
      router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
