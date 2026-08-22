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
  const [showIosHelp,setShowIosHelp]=useState(false);
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
    setNotice("");
    if(installed){
      setNotice(uk?"Atlas уже встановлено на цьому телефоні.":"Atlas is already installed on this phone.");
      return;
    }
    if(installPrompt){
      await installPrompt.prompt();
      const result=await installPrompt.userChoice;
      if(result?.outcome==="accepted")setNotice(uk?"Встановлення Atlas розпочато.":"Atlas installation started.");
      setInstallPrompt(null);window.atlasInstallPrompt=null;
      return;
    }
    if(device==="ios"){
      setShowIosHelp(true);
      setNotice(uk?"На iPhone Apple вимагає підтвердити додавання через меню Safari.":"On iPhone, Apple requires confirmation through Safari's menu.");
      return;
    }
    setNotice(uk?"Відкрийте Atlas у Chrome та натисніть цю кнопку ще раз. Якщо системне вікно не з’явиться — меню ⋮ → «Встановити застосунок».":"Open Atlas in Chrome and press this button again. If the system prompt does not appear, use ⋮ → Install app.");
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
        <h1>{uk?"Atlas на телефон":"Atlas on your phone"}</h1>
        <p>{uk?"Натисніть одну кнопку нижче. На Android відкриється системне встановлення. На iPhone Atlas покаже останню дію, яку Apple вимагає підтвердити вручну.":"Press the single button below. On Android the system installer opens. On iPhone Atlas shows the final action Apple requires you to confirm manually."}</p>

        {!installed?<button className="installAtlasButton" type="button" onClick={installAtlas} style={{width:"100%",justifyContent:"center",fontSize:17,padding:"16px 20px",marginBottom:12}}><Download size={21}/>{uk?"Встановити Atlas":"Install Atlas"}</button>:<div className="installedBadge" style={{marginBottom:12}}><Check size={21}/><span><strong>{uk?"Atlas уже встановлено":"Atlas is already installed"}</strong><small>{uk?"Відкривайте його з іконки на головному екрані":"Open it from the Home Screen icon"}</small></span></div>}

        {showIosHelp&&<div style={{background:"#fff7df",border:"1px solid #ead79b",borderRadius:16,padding:"14px 16px",marginBottom:14,textAlign:"left"}}>
          <strong style={{display:"block",marginBottom:7}}>{uk?"iPhone — ще 2 натискання":"iPhone — 2 more taps"}</strong>
          <div style={{display:"grid",gap:6,fontSize:14,lineHeight:1.45}}>
            <span>1. {uk?"У Safari натисніть кнопку «Поділитися» ↑.":"In Safari, tap Share ↑."}</span>
            <span>2. {uk?"Оберіть «На початковий екран» → «Додати».":"Choose Add to Home Screen → Add."}</span>
          </div>
        </div>}

        <div className="shareAppPrimaryActions">
          <button className="shareNativeButton" type="button" onClick={shareAtlas}><Share2 size={20}/>{uk?"Поділитися Atlas":"Share Atlas"}</button>
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
      <div className="installAtlasHeading"><span>{uk?"ЯК ЦЕ ПРАЦЮЄ":"HOW IT WORKS"}</span><h2>{uk?"Іконка Atlas на головному екрані":"Atlas icon on the Home Screen"}</h2><p>{uk?"Після встановлення Atlas відкривається окремим вікном — без пошуку посилання в чаті.":"After installation, Atlas opens in its own window without searching for the link in chat."}</p></div>
      <div className="installDeviceGrid">
        <article className={device==="ios"?"detected":""}><div className="deviceLabel"><span></span><strong>iPhone / iPad</strong>{device==="ios"&&<b>{uk?"Ваш пристрій":"Your device"}</b>}</div><ol><li>{uk?"Натисніть «Встановити Atlas» вище.":"Tap Install Atlas above."}</li><li>{uk?"Safari: «Поділитися» → «На початковий екран».":"Safari: Share → Add to Home Screen."}</li></ol></article>
        <article className={device==="android"?"detected":""}><div className="deviceLabel"><span>●</span><strong>Android</strong>{device==="android"&&<b>{uk?"Ваш пристрій":"Your device"}</b>}</div><ol><li>{uk?"Відкрийте Atlas у Chrome.":"Open Atlas in Chrome."}</li><li>{uk?"Натисніть «Встановити Atlas» — далі підтвердіть системне вікно.":"Tap Install Atlas, then confirm the system prompt."}</li></ol></article>
      </div>
    </section>
  </main>;
}
