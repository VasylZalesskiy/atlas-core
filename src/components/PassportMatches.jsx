import {BadgeCheck,MapPin,MessageCircle,UserRound} from "lucide-react";

const box={background:"#fff",border:"1px solid #dfe8e2",borderRadius:20,padding:22};
const state={padding:"16px",borderRadius:14,background:"#f4f8f5",color:"#526159"};

export default function PassportMatches({matches,loading,error,medical=false}){
  return <section style={box}>
    <div className="sectionHeading">
      <span>ПАСПОРТИ МОЖЛИВОСТЕЙ</span>
      <h2>{medical?"Хто з людей може допомогти":"Знайдені можливості людей"}</h2>
    </div>

    {loading&&<div style={state}>Шукаю серед Паспортів можливостей…</div>}

    {!loading&&error&&<div style={state}>Пошук у Паспортах тимчасово недоступний.</div>}

    {!loading&&!error&&matches.length===0&&<div style={state}>
      У Паспортах поки не знайдено відповідної можливості. Atlas продовжить пошук в інших джерелах.
    </div>}

    {!loading&&!error&&matches.length>0&&<div style={{display:"grid",gap:12}}>
      {matches.map((item,index)=><article key={item.slug||`${item.name}-${index}`} style={{display:"grid",gridTemplateColumns:"44px 1fr",gap:13,padding:16,border:"1px solid #dce8e0",borderRadius:16,background:"#f8fbf9"}}>
        <div style={{width:42,height:42,borderRadius:"50%",display:"grid",placeItems:"center",background:"#dff3e6",color:"#0f7a43"}}><UserRound size={20}/></div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <strong>{item.name||"Користувач Atlas"}</strong>
            <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#0d7a41",fontWeight:800}}><BadgeCheck size={14}/> знайдено в Atlas</span>
          </div>
          <h3 style={{margin:"7px 0 5px",fontSize:18}}>{item.headline||"Можливість"}</h3>
          {item.can_help&&<p style={{margin:"0 0 10px",color:"#5d6c63",lineHeight:1.45}}>{item.can_help}</p>}
          {item.city&&<small style={{display:"flex",alignItems:"center",gap:5,color:"#66746c",marginBottom:12}}><MapPin size={14}/>{item.city}</small>}
          <button className="secondary" type="button" disabled title="Приватний запит буде підключено наступним кроком">
            <MessageCircle size={16}/> Запросити через Atlas
          </button>
        </div>
      </article>)}
    </div>}

    <p style={{fontSize:11,color:"#6d7a72",margin:"14px 0 0",lineHeight:1.45}}>Контактні дані власника можливості не показуються. Зв’язок відкриватиметься через приватний запит Atlas після його згоди.</p>
  </section>;
}
