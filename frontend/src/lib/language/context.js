import { createContext, useContext } from "react";

/**
 * The language the interface is being read in.
 *
 * Only the two the firm works in. Records are entered in both - a branch has
 * an English name and an Arabic one - but only one is ever shown, because a
 * page that prints every name twice is a page nobody finishes reading.
 */
export const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "ar", label: "العربية", short: "ع" },
];

export const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

/**
 * The right half of a record that is held in both languages.
 *
 * Falls back to the other language rather than showing nothing: a branch with
 * no Arabic name still has to appear in an Arabic list.
 */
export function inLanguage(language, english, arabic) {
  if (language === "ar") return arabic || english || "";
  return english || arabic || "";
}
