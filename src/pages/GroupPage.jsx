import {ArrowLeft,Copy,Home,Link2,RefreshCw,UsersRound} from "lucide-react";
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
export default function GroupPage(){
  const {groupId}=useParams();
  const [identity,setIdentity]=useState(null);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const account=identity?.accounts?.[0]||null;
  const group=data?.group||null;
  const members=data?.members||[];

  const myMembership=useMemo(()=>members.find(item=>item.account_id===account?.account_id)||null,[members,account?.account_id]);

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
        <div className="groupHeroCopy"><span>ATLAS · ГРУПА</span><h1>{group.name}</h1><p>{group.description||"Спільне коло користувачів Atlas."}</p><small>{group.city||"Локація не вказана"} · {members.length} учасників</small></div>
      </div>

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
