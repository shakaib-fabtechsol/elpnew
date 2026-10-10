import { useEffect, useState } from "react";
import { LanguageContext } from "./context";

const STORAGE_KEY = "yands.language";

/** What was chosen last time, or English on a first visit. */
function stored() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "en";
  } catch {
    // Private windows and blocked site data throw rather than return null.
    return "en";
  }
}

/**
 * Holds the language the interface is read in.
 *
 * Kept in the browser rather than on the record, because it is a property of
 * the person reading and not of the firm: two people at the same desk can want
 * different languages, and neither choice belongs in the database.
 */
export default function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(stored);

  /**
   * The document itself is told which language it is in, and which way it
   * runs.
   *
   * Translating the words is only half of it: every logical property in the
   * stylesheet - the rule beside a section title, the side a label starts on,
   * which end a number sits at - reads its direction from here. Set on the
   * document rather than on a wrapper so that menus, dialogs and tooltips,
   * which render outside the app's own tree, turn round with everything else.
   *
   * en-GB rather than plain en: it is what makes the browser's own date
   * fields read and accept DD/MM/YYYY.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.lang = language === "ar" ? "ar" : "en-GB";
    root.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = (next) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Nothing to do: the choice still holds for this session.
    }
  };

  return (
    <LanguageContext value={{ language, setLanguage }}>
      {children}
    </LanguageContext>
  );
}
