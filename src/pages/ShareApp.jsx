import {useEffect,useMemo,useState} from "react";
import {Check,Copy,Download,ExternalLink,MessageCircleMore,Send,Share2,Smartphone} from "lucide-react";
import {QRCodeSVG} from "qrcode.react";
import {ATLAS_SHARE_URL,atlasShareText,createMessengerLinks,isAtlasInstalled} from "../services/shareApp";
import "../styles/shareApp.css";

function browserDevice(){
  if(typeof navigator==="undefined")return "other";
  const source=navigator.userAgent||"";
  if(/iPhone|iPad|iPod/i.test(source))return "ios";
  if(/Android/i.test(source))return "android";
  return "other";
}

export default function ShareApp({lang="uk"}){
  const uk=lang!=="en";
  const [copied,setCopied]=useState(false);
  const [installPrompt,setInstallPrompt]=useState(()=>window.atlasInstallPrompt||null);
  const [installed,setInstalled]=useState(isAtlasInstalled);
  const [notice,setNotice]=useState("");
  const device=browserDevice();
  const shareText=atlasShareText(lang);
  const links=useMemo(()=>createMessengerLinks(lang),[lang]);

  useEffect(()=>{
    const ready=()=>setInstallPrompt(window.atlasInstallPrompt||null);
    const complete=()=>{setInstallPrompt(null);setInstalled(true);setNotice(uk?"Atlas встановлено на ваш телефон.":"Atlas is installed on your phone.")};
    window.addEventListener("atlas-install-ready",ready);
    window.addEventListener("atlas-app-installed",complete);
    return()=>{window.removeEventListener("atlas-install-ready",ready);window.removeEventListener("atlas-app-installed",complete)};
  },[uk]);

  async function shareAtlas(){
    setNotice("");
    if(navigator.share){
      try{await navigator.share({title:"Atlas",text:shareText,url:ATLAS_SHARE_URL});setNotice(uk?"Меню поширення відкрито.":"Share menu opened.")}catch(error){if(error?.name!=="AbortError")setNotice(uk?"Не вдалося відкрити меню. Скопіюйте посилання нижче.":"The share menu could not be opened. Copy the link below.")}
      return;
    }
    await copyLink();
  }

  async function copyLink(){
    try{
      await navigator.clipboard.writeText(ATLAS_SHARE_URL);
      setCopied(true);setNotice(uk?"Посилання скопійовано. Надішліть його у будь-який месенджер.":"Link copied. Send it in any messenger.");
      window.setTimeout(()=>setCopied(false),2200);
    }catch{setNotice(ATLAS_SHARE_URL)}
  }

  async function installAtlas(){
    if(!installPrompt)return;
    await installPrompt.prompt();
    const result=await installPrompt.userChoice;
    if(result?.outcome==="accepted")setNotice(uk?"Встановлення Atlas розпочато.":"Atlas installation started.");
    setInstallPrompt(null);window.atlasInstallPrompt=null;
  }

  function downloadQr(){
    const svg=document.querySelector(".shareQrFrame svg");
    if(!svg)return;
    const source=new XMLSerializer().serializeToString(svg);
    const blob=new Blob([source],{type:"image/svg+xml;charset=utf-8"});
    const href=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=href;link.download="atlas-qr.svg";link.click();
    window.setTimeout(()=>URL.revokeObjectURL(href),1000);
  }

  return <main className="page appPage shareAppPage">
    <section className="shareAppHero">
      <div className="shareAppIntro">
        <span className="shareAppMark"><img src="/atlas-icon.svg" alt=""/>ATLAS</span>
        <span className="shareAppEyebrow">{uk?"ОДНЕ ПОСИЛАННЯ · БУДЬ-ЯКИЙ ТЕЛЕФОН":"ONE LINK · ANY PHONE"}</span>
        <h1>{uk?"Передайте Atlas за 10 секунд":"Share Atlas in 10 seconds"}</h1>
        <p>{uk?"Покажіть QR-код людині поруч або надішліть посилання через Telegram, Viber, WhatsApp чи будь-який інший месенджер.":"Show the QR code to someone nearby or send the link through Telegram, Viber, WhatsApp, or any other messenger."}</p>
        <div className="shareAppPrimaryActions">
          <button className="shareNativeButton" type="button" onClick={shareAtlas}><Share2 size={20}/>{uk?"Поділитися через телефон":"Share from phone"}</button>
          <button className="shareCopyButton" type="button" onClick={copyLink}>{copied?<Check size={19}/>:<Copy size={19}/>} {copied?(uk?"Скопійовано":"Copied"):(uk?"Копіювати посилання":"Copy link")}</button>
        </div>
        <div className="shareLinkBox"><span>{ATLAS_SHARE_URL}</span><button type="button" onClick={copyLink} aria-label={uk?"Копіювати посилання":"Copy link"}><Copy size={17}/></button></div>
        {notice&&<div className="shareAppNotice" role="status" aria-live="polite">{notice}</div>}
      </div>

      <div className="shareQrCard">
        <div className="shareQrHeading"><span><Smartphone size={19}/></span><div><strong>{uk?"Наведіть камеру телефону":"Point the phone camera"}</strong><small>{uk?"QR відкриє офіційний Atlas":"QR opens the official Atlas"}</small></div></div>
        <div className="shareQrFrame"><QRCodeSVG value={ATLAS_SHARE_URL} size={236} level="H" marginSize={3} fgColor="#074f2e" bgColor="#ffffff" title={uk?"QR-код для відкриття Atlas":"QR code to open Atlas"}/><img src="/atlas-icon.svg" alt=""/></div>
        <button className="downloadQrButton" type="button" onClick={downloadQr}><Download size={17}/>{uk?"Зберегти QR-код":"Save QR code"}</button>
      </div>
    </section>

    <section className="messengerShareSection">
      <div><span>{uk?"НАДІСЛАТИ ОДРАЗУ":"SEND DIRECTLY"}</span><h2>{uk?"Оберіть месенджер":"Choose a messenger"}</h2><p>{uk?"Системна кнопка вище показує всі застосунки, встановлені на вашому телефоні.":"The system share button above shows every compatible app installed on your phone."}</p></div>
      <div className="messengerButtons">
        <a className="telegram" href={links.telegram} target="_blank" rel="noreferrer"><Send size={20}/><span>Telegram</span><ExternalLink size={15}/></a>
        <a className="viber" href={links.viber}><MessageCircleMore size={20}/><span>Viber</span><ExternalLink size={15}/></a>
        <a className="whatsapp" href={links.whatsapp} target="_blank" rel="noreferrer"><MessageCircleMore size={20}/><span>WhatsApp</span><ExternalLink size={15}/></a>
      </div>
    </section>

    <section className="installAtlasSection">
      <div className="installAtlasHeading"><span>{uk?"ВСТАНОВИТИ ЯК ЗАСТОСУНОК":"INSTALL AS AN APP"}</span><h2>{uk?"Іконка Atlas на головному екрані":"Atlas icon on the Home Screen"}</h2><p>{uk?"Після встановлення Atlas відкривається окремим вікном — без пошуку посилання в чаті.":"After installation, Atlas opens in its own window without searching for the link in chat."}</p></div>
      {installed?<div className="installedBadge"><Check size={21}/><span><strong>{uk?"Atlas уже встановлено":"Atlas is already installed"}</strong><small>{uk?"Відкривайте його з іконки на екрані":"Open it from the Home Screen icon"}</small></span></div>:installPrompt?<button className="installAtlasButton" type="button" onClick={installAtlas}><Download size={20}/>{uk?"Встановити Atlas зараз":"Install Atlas now"}</button>:null}
      <div className="installDeviceGrid">
        <article className={device==="ios"?"detected":""}><div className="deviceLabel"><span></span><strong>iPhone / iPad</strong>{device==="ios"&&<b>{uk?"Ваш пристрій":"Your device"}</b>}</div><ol><li>{uk?"Відкрийте Atlas у Safari.":"Open Atlas in Safari."}</li><li>{uk?"Натисніть «Поділитися».":"Tap Share."}</li><li>{uk?"Оберіть «На початковий екран».":"Choose Add to Home Screen."}</li></ol></article>
        <article className={device==="android"?"detected":""}><div className="deviceLabel"><span>●</span><strong>Android</strong>{device==="android"&&<b>{uk?"Ваш пристрій":"Your device"}</b>}</div><ol><li>{uk?"Відкрийте Atlas у Chrome.":"Open Atlas in Chrome."}</li><li>{uk?"Натисніть меню ⋮.":"Tap the ⋮ menu."}</li><li>{uk?"Оберіть «Встановити застосунок».":"Choose Install app."}</li></ol></article>
      </div>
    </section>
  </main>;
}
