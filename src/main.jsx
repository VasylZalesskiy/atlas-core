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
  let last=0;
  try{last=Number(sessionStorage.getItem(key)||0)}catch{}
  if(now-last<10000)return false;
  try{sessionStorage.setItem(key,String(now))}catch{}
  window.location.reload();
  return true;
};

window.addEventListener("vite:preloadError",event=>{
  event.preventDefault();
  recoverFromStaleBundle();
});
window.addEventListener("unhandledrejection",event=>{
  const text=String(event?.reason?.message||event?.reason||"");
  if(/dynamically imported module|failed to fetch.*module|chunkloaderror|loading chunk/i.test(text)){
    event.preventDefault();
    recoverFromStaleBundle();
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
      const registration=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
      await registration.update();
      if(registration.waiting)registration.waiting.postMessage({type:"SKIP_WAITING"});
      registration.addEventListener("updatefound",()=>{
        const worker=registration.installing;
        if(!worker)return;
        worker.addEventListener("statechange",()=>{
          if(worker.state==="installed"&&navigator.serviceWorker.controller)worker.postMessage({type:"SKIP_WAITING"});
        });
      });
      let refreshing=false;
      navigator.serviceWorker.addEventListener("controllerchange",()=>{
        if(refreshing)return;
        refreshing=true;
        window.location.reload();
      });
    }catch{}
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
