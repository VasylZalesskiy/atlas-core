export const ATLAS_SHARE_URL="https://atlas-core-two.vercel.app/";

export function atlasShareText(lang="uk"){
  return lang==="en"
    ?"Atlas connects people's needs with other people's capabilities. Open it or install it on your phone."
    :"Atlas поєднує потреби людей із можливостями інших. Відкрийте або встановіть застосунок на телефон.";
}

export function createMessengerLinks(lang="uk",url=ATLAS_SHARE_URL){
  const text=atlasShareText(lang);
  const fullMessage=`${text} ${url}`;
  return {
    telegram:`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    whatsapp:`https://wa.me/?text=${encodeURIComponent(fullMessage)}`,
    viber:`viber://forward?text=${encodeURIComponent(fullMessage)}`
  };
}

export function isAtlasInstalled(){
  if(typeof window==="undefined")return false;
  return Boolean(window.matchMedia?.("(display-mode: standalone)").matches||window.navigator.standalone);
}
