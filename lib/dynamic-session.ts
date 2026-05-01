import type { DynamicTestSession } from "@/types";

const PREFIX = "dg_dyn_";

export function saveDynamicTest(session: DynamicTestSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${PREFIX}${session.id}`, JSON.stringify(session));
    sessionStorage.setItem(`${PREFIX}latest`, session.id);
  } catch { /* storage full or unavailable — fail silently */ }
}

export function loadDynamicTest(id: string): DynamicTestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as DynamicTestSession) : null;
  } catch { return null; }
}

export function latestDynamicTestId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${PREFIX}latest`);
}

export function pruneOldDynamicTests(keepLast = 5): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PREFIX) && k !== `${PREFIX}latest`) keys.push(k);
    }
    if (keys.length <= keepLast) return;
    keys.sort();
    keys.slice(0, keys.length - keepLast).forEach(k => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}
