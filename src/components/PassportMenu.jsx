import {ArrowRight,HeartHandshake,IdCard,Truck} from "lucide-react";
import {Link,useLocation} from "react-router-dom";
import "../styles/passportMenu.css";

export default function PassportMenu({lang="uk"}){
  const uk=lang!=="en";
  const {pathname}=useLocation();
  return <section className="passportMenu" aria-label={uk?"Меню Паспортів Atlas":"Atlas Passport menu"}>
    <div className="passportMenuTitle">
      <div><Truck size={21}/><span><strong>{uk?"Доставка в будинок":"Building delivery"}</strong><small>{uk?"Пілот Atlas: потреба → пропозиція → доставка":"Atlas pilot: need → offer → delivery"}</small></span></div>
      <div className="passportFlow"><span>1</span>{uk?"Замовлення":"Order"}<b>→</b><span>2</span>{uk?"Збіг":"Match"}<b>→</b><span>3</span>{uk?"Доставка":"Delivery"}</div>
    </div>
    <div className="passportMenuGrid">
      <Link className={pathname.startsWith("/needs")?"active":""} to="/needs">
        <span className="passportMenuIcon need"><HeartHandshake size={24}/></span>
        <span><strong>{uk?"Замовити / Потреби":"Order / Needs"}</strong><small>{uk?"Що потрібно, скільки і до коли":"What you need, quantity and date"}</small></span>
        <ArrowRight size={18}/>
      </Link>
      <Link className={pathname.startsWith("/profile")?"active":""} to="/profile">
        <span className="passportMenuIcon offer"><IdCard size={24}/></span>
        <span><strong>{uk?"Продати / Можливості":"Sell / Opportunities"}</strong><small>{uk?"Що маєте, ціна, кількість і доставка":"What you have, price, quantity and delivery"}</small></span>
        <ArrowRight size={18}/>
      </Link>
    </div>
  </section>;
}
