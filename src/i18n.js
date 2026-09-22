import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import dict from "./data/translations";

const resources={
  uk:{translation:dict.uk},
  en:{translation:dict.en}
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs:["uk","en"],
    fallbackLng:"uk",
    load:"languageOnly",
    detection:{
      order:["localStorage","navigator"],
      lookupLocalStorage:"atlas-language",
      caches:["localStorage"]
    },
    interpolation:{escapeValue:false}
  });

export default i18n;
