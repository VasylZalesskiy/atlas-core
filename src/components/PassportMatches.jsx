import {BadgeCheck,MapPin,MessageCircle,UserRound} from "lucide-react";

export default function PassportMatches({matches,loading,error,medical=false}){
  return <section className="passportMatches">
    <div className="sectionHeading">
      <span>ПАСПОРТИ МОЖЛИВОСТЕЙ</span>
      <h2>{medical?"Хто з людей може допомогти":"Знайдені можливості людей"}</h2>
    </div>

    {loading&&<div className="passportSearchState">Шукаю серед Паспортів можливостей…</div>}

    {!loading&&error&&<div className="passportSearchState muted">Пошук у Паспортам тимчасово недоступний.</div>}

    {!loading&&!error&&matches.length===0&&<div className="passportSearchState muted">
      У Паспортам поки не знайдено відповідної можливості. Atlas має продовжити пошук в інших джерелах.
    </div>}

    {!loading&&!error&&matches.length>0&&<div className="passportMatchList">
      {matches.map((item,index)=><article className="passportMatch" key={item.slug||`${item.name}-${index}`}>
        <div className="passportAvatar"><UserRound size={20}/></div>
        <div className="passportMatchBody">
          <div className="passportMatchTop">
            <strong>{item.name||"Користувач Atlas"}</strong>
            <span><BadgeCheck size={14}/> знайдено в Atlas</span>
          </div>
          <h3>{item.headline||"Можливість"}</h3>
          {item.can_help&&<p>{item.can_help}</p>}
          {item.city&&<small><MapPin size={14}/>{item.city}</small>}
          <button className="secondary" type="button" disabled title="Приватний запит буде підключено наступним кроком">
            <MessageCircle size={16}/> Запросити через Atlas
          </button>
        </div>
      </article>)}
    </div>}

    <p className="passportPrivacy">Контактні дані власника можливості не показуються. Зв’язок має відкриватися через приватний запит Atlas після його згоди.</p>
  </section>;
}
