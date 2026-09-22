import {ArrowLeft,Copy,Home,Link2,Plus,RefreshCw,Trash2,UsersRound} from "lucide-react";
import {useEffect,useMemo,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {addGroupOpportunity,leaveAtlasGroup,loadAtlasGroup,loadGroupIdentity,opportunityGroups,regenerateGroupInvite,removeOpportunityFromGroup} from "../services/groupStore";
import "../styles/groups.css";

function errorText(error){
  const text=String(error?.message||error||"");
  if(/group-admin-required/i.test(text))return "Ця дія доступна лише адміністратору групи.";
  if(/permission|row-level|access/i.test(text))return "У вас немає доступу до цієї групи.";
  return text||"Не вдалося виконати дію.";
}

export default function GroupPage(){
  const {groupId}=useParams();
  const [identity,setIdentity]=useState(null);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [entry,setEntry]=useState({group:"have",text:""});

  const account=identity?.accounts?.[0]||null;
  const activePassport=identity?.passport||null;
  const group=data?.group||null;
  const members=data?.members||[];
  const opportunities=data?.opportunities||[];

  const myMembership=useMemo(()=>members.find(item=>item.account_id===account?.account_id)||null,[members,account?.account_id]);
  const selectedPassport=useMemo(()=>{
    const id=myMembership?.passport_id||activePassport?.id;
    return identity?.passports?.find(item=>item.id===id)||activePassport||null;
  },[myMembership?.passport_id,activePassport,identity?.passports]);

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
  const groupLabels=useMemo(()=>new Map(opportunityGroups.map(item=>[item.value,item.label])),[]);

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

  async function addOpportunity(event){
    event.preventDefault();
    if(!group||!account||!selectedPassport||busy||!entry.text.trim())return;
    setBusy("add");setError("");setNotice("");
    try{
      await addGroupOpportunity({
        groupId:group.id,
        accountId:account.account_id,
        passportId:selectedPassport.id,
        text:entry.text,
        group:entry.group
      });
      setEntry(current=>({...current,text:""}));
      const next=await loadAtlasGroup(group.id);
      setData(next);
      setNotice("Додано до групи і до вашого Паспорта можливостей.");
    }catch(cause){setError(errorText(cause))}
    finally{setBusy("")}
  }

  async function removeFromGroup(opportunityId){
    if(!group||busy)return;
    setBusy(opportunityId);setError("");
    try{
      await removeOpportunityFromGroup(group.id,opportunityId);
      setData(current=>({...current,opportunities:current.opportunities.filter(item=>item.opportunity_id!==opportunityId)}));
    }catch(cause){setError(errorText(cause))}
    finally{setBusy("")}
  }

  async function leaveGroup(){
    if(!group||!account||busy||myMembership?.role==="owner")return;
    if(!confirm("Вийти з цієї групи?"))return;
    setBusy("leave");
    try{
      await leaveAtlasGroup(group.id,account.account_id);
      window.location.href="/groups";
    }catch(cause){setError(errorText(cause));setBusy("")}
  }

  if(loading)return <main className="groupsPage"><section className="groupsShell"><p>Відкриваю групу…</p></section></main>;
  if(!group)return <main className="groupsPage"><section className="groupsShell"><Link className="groupBack" to="/groups"><ArrowLeft size={17}/>До груп</Link><div className="groupError">{error||"Групу не знайдено."}</div></section></main>;

  return <main className="groupsPage">
    <section className="groupsShell">
      <Link className="groupBack" to="/groups"><ArrowLeft size={17}/>Мої групи</Link>

      <div className="groupHero">
        <div className="groupHeroIcon"><Home size={28}/></div>
        <div className="groupHeroCopy"><span>ATLAS · ГРУПА</span><h1>{group.name}</h1><p>{group.description||"Спільний простір можливостей учасників."}</p><small>{group.city||"Локація не вказана"} · {members.length} учасників</small></div>
      </div>

      <section className="groupInviteBox">
        <div><Link2 size={20}/><div><strong>Запросити в групу</strong><span>Надішліть це посилання іншому користувачу Atlas.</span></div></div>
        <div className="groupInviteActions">
          <button type="button" className="groupPrimary" onClick={copyInvite}><Copy size={16}/>Скопіювати посилання</button>
          {["owner","admin"].includes(myMembership?.role)&&<button type="button" className="groupSecondary" disabled={busy==="invite"} onClick={regenerateInvite}><RefreshCw size={16}/>{busy==="invite"?"Оновлюю…":"Нове посилання"}</button>}
        </div>
      </section>

      <section className="groupMembers">
        <div className="groupSectionTitle"><h2><UsersRound size={20}/>Учасники</h2><span>{members.length}</span></div>
        <div className="groupMemberChips">{members.map(member=><div className="groupMemberChip" key={member.account_id}>
          <span>{member.passport?.entity_type==="company"?"🏢":"👤"}</span>
          <div><strong>{member.passport?.display_name||"Користувач Atlas"}</strong><small>{member.role==="owner"?"Власник":member.role==="admin"?"Адміністратор":"Учасник"}</small></div>
        </div>)}</div>
      </section>

      <section className="groupComposer">
        <div className="groupSectionTitle"><h2>Що у вас є або що ви можете?</h2></div>
        {!account||!selectedPassport?<div className="groupGate"><p>Щоб додавати можливості, увійдіть у свою сторінку Atlas.</p><Link className="primaryLink" to="/profile">Моя сторінка</Link></div>:
        <form onSubmit={addOpportunity}>
          <div className="groupComposerIdentity">Публікує: <strong>{selectedPassport.display_name}</strong></div>
          <div className="groupComposerGrid">
            <select value={entry.group} onChange={e=>setEntry({...entry,group:e.target.value})}>
              {opportunityGroups.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <textarea value={entry.text} onChange={e=>setEntry({...entry,text:e.target.value})} placeholder="Наприклад: маю дриль і можу дати сусідам покористуватися"/>
            <button className="groupPrimary" disabled={busy==="add"||!entry.text.trim()}><Plus size={17}/>{busy==="add"?"Додаю…":"Додати"}</button>
          </div>
        </form>}
      </section>

      <section className="groupFeed">
        <div className="groupSectionTitle"><h2>Можливості групи</h2><span>{opportunities.length}</span></div>
        {opportunities.length===0?<div className="groupEmpty">Поки ніхто нічого не додав. Почніть із першої можливості.</div>:
        <div className="groupFeedList">{opportunities.map(item=>{
          const opportunity=item.opportunity;
          const mine=item.added_by_account_id===account?.account_id;
          return <article className="groupFeedCard" key={item.opportunity_id}>
            <div className="groupFeedAuthor"><span>{item.passport?.entity_type==="company"?"🏢":"👤"}</span><div><strong>{item.passport?.display_name||"Користувач Atlas"}</strong><small>{item.passport?.city||""}</small></div></div>
            <div className="groupFeedBody"><span className="groupFeedType">{groupLabels.get(opportunity.group)||"Можливість"}</span><p>{opportunity.text}</p></div>
            <div className="groupFeedActions">
              {item.passport?.slug&&<Link to={"/p/"+item.passport.slug}>Відкрити Паспорт</Link>}
              {(mine||["owner","admin"].includes(myMembership?.role))&&<button type="button" disabled={busy===item.opportunity_id} onClick={()=>removeFromGroup(item.opportunity_id)}><Trash2 size={15}/>Прибрати</button>}
            </div>
          </article>;
        })}</div>}
      </section>

      {myMembership?.role!=="owner"&&<button className="groupLeave" type="button" disabled={busy==="leave"} onClick={leaveGroup}>Вийти з групи</button>}
      {notice&&<div className="groupNotice">{notice}</div>}
      {error&&<div className="groupError">{error}</div>}
    </section>
  </main>;
}
