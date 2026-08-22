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
  window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
}
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
