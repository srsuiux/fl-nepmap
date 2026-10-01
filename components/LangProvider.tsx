"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { setLangGlobal, type Lang } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });
export const useLang = () => useContext(Ctx);

export default function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en"); // "en" on the server and first paint so hydration matches
  setLangGlobal(lang); // set before children render, so t() calls inside them see the right language
  useEffect(() => {
    let l: Lang = typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ne") ? "ne" : "en";
    try { const s = localStorage.getItem("nfw-lang"); if (s === "en" || s === "ne") l = s; } catch { /* storage blocked */ }
    setLangState(l);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem("nfw-lang", l); } catch { /* ignore */ } };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}
