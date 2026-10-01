"use client";
import { Icon } from "./Icon";
import { useLang } from "./LangProvider";
import { t } from "@/lib/i18n";

export default function EmergencyBar() {
  const { lang, setLang } = useLang();
  return (
    <nav className="emerg" aria-label={t("Emergency numbers")}>
      <span className="elabel">{t("Emergency")}</span>
      <a href="tel:100"><Icon name="police" size={16} />{t("Police")} 100</a>
      <a href="tel:102"><Icon name="ambulance" size={16} />{t("Ambulance")} 102</a>
      <a href="tel:1234"><Icon name="siren" size={16} />{t("Disaster")} 1234</a>
      <span className="lang" role="group" aria-label="Language">
        <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
        <button aria-pressed={lang === "ne"} onClick={() => setLang("ne")} lang="ne">नेपाली</button>
      </span>
    </nav>
  );
}
