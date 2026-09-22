import {Building2,DoorOpen,Home,Plus,UsersRound} from "lucide-react";
import {useEffect,useMemo,useState} from "react";
import {Link,useNavigate,useSearchParams} from "react-router-dom";
import {createAtlasGroup,joinAtlasGroup,loadGroupIdentity,loadMyGroups} from "../services/groupStore";
import "../styles/groups.css";

const typeOptions=[
  ["building","Будинок"],
  ["dormitory","Гуртожиток"],
  ["community","Спільнота"],
  ["team","Команда"],
  ["other","Інше"]
];

function errorText(error){
  const text=String(error?.message||error||"");
  if(/invite-not-found/i.test(text))return "Посилання або код запрошення не знайдено.";
  if(/account-required|passport-required|access-denied/i.test(text))return "Спочатку увійдіть у Atlas і виберіть свою сторінку.";
  if(/group-name-invalid/i.test(text))return "Вкажіть назву групи.";
  return text||"Не вдалося виконати дію.";
}

export default function Groups(){
  const navigate=useNavigate();
  const [params,setParams]=useSearchParams();
  const [identity,setIdentity]=useState(null);
  const [groups,setGroups]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [createForm,setCreateForm]=useState({name:"",groupType:"building",description:"",city:""});
  const [inviteCode,setInviteCode]=useState(()=>params.get("join")||"");

  const account=identity?.accounts?.[0]||null;
  const passport=identity?.passport||null;
  const canUse=Boolean(account&&passport);

  async function refresh(){
    setLoading(true);setError("");
    try{
      const [nextIdentity,nextGroups]=await Promise.all([loadGroupIdentity(),loadMyGroups()]);
      setIdentity(nextIdentity);
      setGroups(nextGroups);
      setCreateForm(current=>({...current,city:current.city||nextIdentity?.passport?.city||""}));
    }catch(cause){setError(errorText(cause))}
    finally{setLoading(false)}
  }

  useEffect(()=>{refresh()},[]);

  const groupTypeLabel=useMemo(()=>new Map(typeOptions),[]);

  async function createGroup(event){
    event.preventDefault();
    if(!canUse||busy)return;
    setBusy("create");setError("");
    try{
      const group=await createAtlasGroup({
        accountId:account.account_id,
        passportId:passport.id,
        name:createForm.name,
        groupType:createForm.groupType,
        description:createForm.description,
        city:createForm.city
      });
      if(group?.id)navigate("/groups/"+group.id);
    }catch(cause){setError(errorText(cause))}
    finally{setBusy("")}
  }

  async function joinGroup(event){
    event.preventDefault();
    if(!canUse||busy||!inviteCode.trim())return;
    setBusy("join");setError("");
    try{
      const group=await joinAtlasGroup({
        accountId:account.account_id,
        passportId:passport.id,
        inviteCode
      });
      setParams({});
      if(group?.id)navigate("/groups/"+group.id);
    }catch(cause){setError(errorText(cause))}
    finally{setBusy("")}
  }

  if(loading)return <main className="groupsPage"><section className="groupsShell"><p>Відкриваю групи Atlas…</p></section></main>;

  return <main className="groupsPage">
    <section className="groupsShell">
      <div className="groupsHeading">
        <div><span>ATLAS · ГРУПИ</span><h1>Мої групи</h1><p>Об’єднайте користувачів будинку, гуртожитку, команди або спільноти. Можливості залишаються в Паспорті, а група задає коло людей для пошуку.</p></div>
        <UsersRound size={34}/>
      </div>

      {!canUse&&<div className="groupGate">
        <strong>Потрібен вхід у Atlas</strong>
        <p>Щоб створювати групи або вступати до них, увійдіть у свою сторінку Atlas і створіть Паспорт.</p>
        <Link className="primaryLink" to="/profile">Відкрити «Моя сторінка»</Link>
      </div>}

      {canUse&&<>
        <section className="groupCreateGrid">
          <form className="groupPanel" onSubmit={createGroup}>
            <div className="groupPanelTitle"><Plus size={20}/><div><strong>Створити групу</strong><small>Наприклад: «Будинок 5» або «Гуртожиток №2»</small></div></div>
            <label><span>Назва</span><input value={createForm.name} onChange={e=>setCreateForm({...createForm,name:e.target.value})} placeholder="Будинок 5" required/></label>
            <div className="groupTwoCols">
              <label><span>Тип</span><select value={createForm.groupType} onChange={e=>setCreateForm({...createForm,groupType:e.target.value})}>{typeOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Місто / район</span><input value={createForm.city} onChange={e=>setCreateForm({...createForm,city:e.target.value})} placeholder="Тернопіль"/></label>
            </div>
            <label><span>Короткий опис</span><textarea value={createForm.description} onChange={e=>setCreateForm({...createForm,description:e.target.value})} placeholder="Для мешканців нашого будинку"/></label>
            <button className="groupPrimary" disabled={busy==="create"||!createForm.name.trim()}>{busy==="create"?"Створюю…":"Створити групу"}</button>
          </form>

          <form className="groupPanel" onSubmit={joinGroup}>
            <div className="groupPanelTitle"><DoorOpen size={20}/><div><strong>Вступити за запрошенням</strong><small>Вставте код або відкрийте посилання від учасника групи.</small></div></div>
            <label><span>Код запрошення</span><input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} placeholder="Наприклад: A1B2C3D4E5F6"/></label>
            <button className="groupPrimary" disabled={busy==="join"||!inviteCode.trim()}>{busy==="join"?"Вступаю…":"Вступити до групи"}</button>
          </form>
        </section>

        <section className="groupListSection">
          <div className="groupSectionTitle"><h2>Ваші групи</h2><span>{groups.length}</span></div>
          {groups.length===0?<div className="groupEmpty">Груп ще немає. Створіть першу або скористайтеся запрошенням.</div>:
            <div className="groupCards">{groups.map(group=><Link className="groupCard" key={group.id} to={"/groups/"+group.id}>
              <div className="groupCardIcon">{group.group_type==="building"?<Building2 size={23}/>:<Home size={23}/>}</div>
              <div><strong>{group.name}</strong><span>{groupTypeLabel.get(group.group_type)||"Група"}{group.city?" · "+group.city:""}</span>{group.description&&<p>{group.description}</p>}</div>
            </Link>)}</div>}
        </section>
      </>}

      {error&&<div className="groupError">{error}</div>}
    </section>
  </main>;
}
