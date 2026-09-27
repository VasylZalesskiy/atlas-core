import {Bell,Globe2} from "lucide-react";
import {Link} from "react-router-dom";
import OnlinePresence from "./OnlinePresence";

export default function Header({lang="uk",setLang,inboxUnread=0}){
  const uk=lang!=="en";
  return <header className="atlasTopbarV3">
    <Link className="atlasTopbarV3Brand" to="/" aria-label={uk?"На головну":"Home"}>
      <b>A</b><span><strong>ATLAS</strong></span>
    </Link>

    <div className="atlasTopbarV3Right">
      <label className="atlasTopbarV3Lang" aria-label="Language">
        <Globe2 size={14}/>
        <select value={lang} onChange={e=>setLang(e.target.value)}>
          <option value="uk">UA</option>
          <option value="en">EN</option>
        </select>
      </label>
      <OnlinePresence lang={lang} compact/>
      <Link className="atlasTopbarV3Bell" to="/messages" aria-label={uk?"Повідомлення":"Messages"}>
        <Bell size={16}/>
        {inboxUnread>0&&<b>{inboxUnread>9?"9+":inboxUnread}</b>}
      </Link>
    </div>
  </header>;
}