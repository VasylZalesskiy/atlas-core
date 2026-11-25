import "./i18n";
import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import App from "./App";
import "./styles/styles.css";
import "./styles/brainSolution.css";
import "./styles/atlas26.css";


const recoverFromStaleBundle=()=>{
  const key="atlas-stale-bundle-reload";
  const now=Date.now();
  let last;
  try{last=Number(sessionStorage.getItem(key)||0)}catch{return false}
  if(now-last<10000)return false;
  try{sessionStorage.setItem(key,String(now))}catch{return false}
  window.location.reload();
  return true;
};

window.addEventListener("vite:preloadError",event=>{
  if(recoverFromStaleBundle())event.preventDefault();
});
window.addEventListener("unhandledrejection",event=>{
  const text=String(event?.reason?.message||event?.reason||"");
  if(/dynamically imported module|failed to fetch.*module|chunkloaderror|loading chunk/i.test(text)){
    if(recoverFromStaleBundle())event.preventDefault();
  }
});


window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  window.atlasInstallPrompt=event;
  window.dispatchEvent(new CustomEvent("atlas-install-ready"));
});

window.addEventListener("appinstalled",()=>{
  window.atlasInstallPrompt=null;
  window.dispatchEvent(new CustomEvent("atlas-app-installed"));
});

if("serviceWorker" in navigator){
  window.addEventListener("load",async()=>{
    try{
      await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
    }catch{}
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
