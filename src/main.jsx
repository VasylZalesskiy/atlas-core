import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import App from "./App";
import "./styles/styles.css";
import "./styles/brainSolution.css";
import "./styles/atlas26.css";

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
