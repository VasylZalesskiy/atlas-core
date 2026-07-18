import {LockKeyhole,UnlockKeyhole} from "lucide-react";

export default function HiddenContactsCard({visible,onToggle,policy,t}){
  return <section className="hiddenContacts"><div>{visible?<UnlockKeyhole/>:<LockKeyhole/>}<div><h2>{t.solutionDetails}</h2><p>{visible?policy:t.hiddenContactsText}</p></div></div><button className="primary" onClick={onToggle}>{visible?t.hideDetails:t.getDetails}</button></section>;
}
