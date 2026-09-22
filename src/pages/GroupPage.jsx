import {ArrowLeft,Copy,Home,Link2,RefreshCw,Search,UsersRound} from "lucide-react";
import {useEffect,useMemo,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {leaveAtlasGroup,loadAtlasGroup,loadGroupIdentity,regenerateGroupInvite} from "../services/groupStore";
import "../styles/groups.css";

function errorText(error){
  const text=String(error?.message||error||"");
  if(/group-admin-required/i.test(text))return "Ця дія доступна лише адміністратору групи.";
  if(/permission|row-level|access/i.test(text))return "У вас немає доступу до цієї групи.";
  return text||"Не вдалося виконати дію.";
}
function normalize(value){return String(value||"").toLowerCase().replace(/[.,!?;:()]/g," ").replace(/\s+/g," ").trim()}
function scoreOpportunity(item,query){
  const q=normalize(query);
  if(!q)return 0;
  const opportunity=item.opportunity||{};
  const passport=item.passport||{};
  const hay=normalize([opportunity.text,opportunity.catalogItemName,opportunity.group,passport.display_name,passport.city].filter(Boolean).join(" "));
  let score=hay.includes(q)?20:0;
  for(const word of q.split(" ").filter(word=>word.length>1))if(hay.includes(word))score+=4;
  return score;
}

export default function GroupPage(){
  const {groupId}=useParams();
  const [identity,setIdentity]=useState(null);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [query,setQuery]=useState("");

  const account=identity?.accounts?.[0]||null;
  const group=data?.group||null;
  const members=data?.members||[];
  const opportunities=data?.opportunities||[];

  const myMembership=useMemo(()=>members.find(item=>item.account_id===account?.account_id)||null,[members,account?.account_id]);
  const results=useMemo(()=>query.trim()
    ?opportunities.map(item=>({...item,searchScore:scoreOpportunity(item,query)})).filter(item=>item.searchScore>0).sort((a,b)=>b.searchScore-a.searchScore).slice(0,20)
    :[],[opportunities,query]);

  async function refresh(){
    setLoading(true);setError("");
    try{
      const [nextIdentity,nextData]=await Promise.all([loadGroupIdentity(),loadAtlasGroup(groupId)]);
      setIdentity(nextIdentity);setData(nextData);
    }catch(cause){setError(errorText(cause))}
    finally{setLoading(false)}
  }
  useEffect(()=>{refresh()},[groupId]);

  const inviteLink=group?window.location.origin+"/groups?join="+encodeURIComponent(group.invite_code):"";

  async function copyInvite(){
    if(!inviteLink)return;
    await navigator.clipboard.writeText(inviteLink);
    setNotice("Посилання-запрошення скопійовано.");
  }
  async function regenerateInvite(){
    if(!group||busy)return;
    setBusy("invite");setError("");
    try{
      const code=await regenerateGroupInvite(group.id);
      setData(current=>({...current,group:{...current.group,invite_code:code}}));
      setNotice("Створено нове посилання-запрошення.");
    }catch(cause){setError(errorText(cause))}
    finally{setBusy("")}
  }
  async function leaveGroup(){
    if(!group||!account||busy||myMembership?.role==="owner")return;
    if(!confirm("Вийти з цієї групи?"))return;
    setBusy("leave");
    try{await leaveAtlasGroup(group.id,account.account_id);window.location.href="/groups"}
    catch(cause){setError(errorText(cause));setBusy("")}
  }

  if(loading)return <main className="groupsPage"><section className="groupsShell"><p>Відкриваю групу…</p></section></main>;
  if(!group)return <main className="groupsPage"><section className="groupsShell"><Link className="groupBack" to="/groups"><ArrowLeft size={17}/>До груп</Link><div className="groupError">{error||"Групу не знайдено."}</div></section></main>;

  return <main className="groupsPage">
    <section className="groupsShell">
      <Link className="groupBack" to="/groups"><ArrowLeft size={17}/>Мої групи</Link>

      <div className="groupHero">
        <div className="groupHeroIcon"><Home size={28}/></div>
        <div className="groupHeroCopy"><span>ATLAS · ГРУПА</span><h1>{group.name}</h1><p>{group.description||"Спільне коло користувачів Atlas."}</p><small>{group.city||"Локація не вказана"} · {members.length} учасників · {opportunities.length} доступних можливостей</small></div>
      </div>

      <section className="groupSearchBox">
        <div className="groupSearchHeading">
          <Search size={22}/>
          <div><strong>Що вам потрібно в цій групі?</strong><span>Atlas покаже тільки релевантні можливості учасників. Ніякої стрічки оголошень.</span></div>
        </div>
        <div className="groupSearchInput">
          <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Наприклад: дриль, доставка, картопля, ремонт"/>
          {query&&<button type="button" onClick={()=>setQuery("")}>Очистити</button>}
        </div>

        {!query.trim()&&<div className="groupSearchEmpty">Введіть, що шукаєте. Atlas перевірить можливості всіх учасників цієї групи.</div>}
        {query.trim()&&results.length===0&&<div className="groupSearchEmpty">
          У цій групі такої можливості не знайдено.
          <Link to={"/solution?q="+encodeURIComponent(query)}>Шукати в усьому Atlas →</Link>
        </div>}
        {results.length>0&&<div className="groupSearchResults">{results.map(item=><article key={item.opportunity_id}>
          <div className="groupResultOwner"><span>{item.passport?.entity_type==="company"?"🏢":"👤"}</span><div><strong>{item.passport?.display_name||"Користувач Atlas"}</strong><small>{item.passport?.city||""}</small></div></div>
          <div className="groupResultText"><p>{item.opportunity?.catalogItemName||item.opportunity?.text}</p></div>
          {item.passport?.slug&&<Link to={"/p/"+item.passport.slug}>Відкрити Паспорт</Link>}
        </article>)}</div>}
      </section>

      <section className="groupMembers">
        <div className="groupSectionTitle"><h2><UsersRound size={20}/>Учасники</h2><span>{members.length}</span></div>
        <div className="groupMemberChips">{members.map(member=><div className="groupMemberChip" key={member.account_id}>
          <span>{member.passport?.entity_type==="company"?"🏢":"👤"}</span>
          <div><strong>{member.passport?.display_name||"Користувач Atlas"}</strong><small>{member.role==="owner"?"Власник":member.role==="admin"?"Адміністратор":"Учасник"}</small></div>
        </div>)}</div>
      </section>

      <section className="groupInviteBox">
        <div><Link2 size={20}/><div><strong>Запросити користувача Atlas</strong><span>Група лише об’єднує людей. Можливості кожен налаштовує у своєму Паспорті.</span></div></div>
        <div className="groupInviteActions">
          <button type="button" className="groupPrimary" onClick={copyInvite}><Copy size={16}/>Скопіювати посилання</button>
          {["owner","admin"].includes(myMembership?.role)&&<button type="button" className="groupSecondary" disabled={busy==="invite"} onClick={regenerateInvite}><RefreshCw size={16}/>{busy==="invite"?"Оновлюю…":"Нове посилання"}</button>}
        </div>
      </section>

      <div className="groupManagePassport">
        <div><strong>Хочете додати або змінити свою можливість?</strong><span>Це робиться тільки у Паспорті можливостей. Там же вибирається, яким групам її показувати.</span></div>
        <Link to="/profile">Відкрити Паспорт</Link>
      </div>

      {myMembership?.role!=="owner"&&<button className="groupLeave" type="button" disabled={busy==="leave"} onClick={leaveGroup}>Вийти з групи</button>}
      {notice&&<div className="groupNotice">{notice}</div>}
      {error&&<div className="groupError">{error}</div>}
    </section>
  </main>;
}
