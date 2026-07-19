import {createContext,useContext,useMemo,useState} from "react";
import uk from "./locales/uk";
import en from "./locales/en";

const dictionaries={uk,en};const LocaleContext=createContext(null);
function detectLanguage(){if(typeof navigator==="undefined")return "uk";return navigator.language?.toLowerCase().startsWith("uk")?"uk":"en"}

export function LocaleProvider({children}){const [lang,setLang]=useState(detectLanguage);const t=useMemo(()=>dictionaries[lang],[lang]);return <LocaleContext.Provider value={{lang,setLang,t}}>{children}</LocaleContext.Provider>}
export function useLocale(){const value=useContext(LocaleContext);if(!value)throw new Error("useLocale must be used inside LocaleProvider");return value}
export {dictionaries};
