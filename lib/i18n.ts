import { NE } from "./ne";

// English text is the key; Nepali comes from the dictionary in ne.ts (a missing entry falls back to English).
export type Lang = "en" | "ne";
let current: Lang = "en";
export const getLang = () => current;
export const setLangGlobal = (l: Lang) => { current = l; };

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = current === "ne" ? (NE[key] ?? key) : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  return s;
}

// "1 incident" / "5 incidents": pick the singular or plural key by count (Nepali has one form, so both map to one string)
export const tn = (n: number, one: string, many: string, vars: Record<string, string | number> = {}) => t(n === 1 ? one : many, { n, ...vars });
