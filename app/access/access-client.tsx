"use client";

import { useEffect, useState } from "react";

type Grant = { email:string; role:"manager"|"client"; clientId?:string; managerName?:string; clientIds?:string[]; permissions:string[]; active:boolean };
type Row = Record<string,any>;
type Entity = { id:string; name?:string; business?:string; email?:string };
type State = { clients:Entity[]; managers:Entity[]; accessGrants?:Grant[]; demoWorkspace?:boolean; [key:string]:unknown };
const sections = [
  ["overview","Overview"],["clients","Clients"],["accounts","Ad accounts / subscriptions"],["topups","Top-ups"],
  ["payments","Payments"],["academy","Academy"],["activity","Activity"],["requestAccounts","Request ad accounts"],
  ["requestTopups","Request top-ups"],["submitPayments","Submit payment proofs"]
];
const defaults = { manager:["overview","clients","accounts","topups","payments","requestAccounts","requestTopups","submitPayments"], client:["overview","accounts","topups","payments","academy","activity","requestAccounts","requestTopups","submitPayments"] };

export default function AccessClient() {
  const [state,setState] = useState<State|null>(null);
  const [revision,setRevision] = useState(0);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [draft,setDraft] = useState<Grant>({email:"",role:"client",clientId:"",permissions:[...defaults.client],active:true});
  const [editing,setEditing] = useState<string|null>(null);
  const [password,setPassword] = useState("");
  const [credentialed,setCredentialed] = useState<string[]>([]);
  useEffect(()=>{void load();},[]);
  async function load(){
    setError("");
    try { const [res,credentials]=await Promise.all([fetch("/api/state",{cache:"no-store"}),fetch("/api/access/credential",{cache:"no-store"})]);const json=await res.json() as {error?:string;state?:State;revision:number};if(!res.ok)throw new Error(json.error);
      if(credentials.ok){const found=await credentials.json() as {emails:string[]};setCredentialed(found.emails||[]);}
      setState(json.state||{clients:[],managers:[],accessGrants:[]});setRevision(json.revision);
    }catch(e){setError(e instanceof Error?e.message:"Could not load access settings.");}
  }
  function chooseRole(role:"manager"|"client") {setDraft({email:"",role,clientId:"",managerName:"",clientIds:[],permissions:[...defaults[role]],active:true});setEditing(null);setPassword("");}
  function chooseEntity(value:string){
    const entity=draft.role==="client"?state?.clients.find(c=>c.id===value):state?.managers.find(m=>m.name===value);
    setDraft(d=>({...d,[d.role==="client"?"clientId":"managerName"]:value,email:entity?.email||d.email,...(d.role==="manager"?{clientIds:state?.clients.filter(c=>(c as Row).manager===value).map(c=>c.id)||[]}:{})}));
  }
  async function persistState(newState:State){
    setBusy(true);setError("");
    try {const res=await fetch("/api/state",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision,state:newState})});const json=await res.json() as {error?:string;revision:number};if(!res.ok)throw new Error(json.error);
      setState(newState);setRevision(json.revision);setEditing(null);setPassword("");setDraft({email:"",role:"client",clientId:"",permissions:[...defaults.client],active:true});
    }catch(e){setError(e instanceof Error?e.message:"Could not save. Refresh this page to review changes.");}finally{setBusy(false);}
  }
  async function persist(next:Grant[]){if(state)await persistState({...state,accessGrants:next});}
  async function clearSamples(){
    if(!state||!window.confirm("Remove the sample records from this workspace? Real records are preserved."))return;
    const collections=["clients","accounts","payments","topups","managers","agencyExpenses","agencyIncome","academy","receivingMethods","activity"];
    const keep=(key:string)=>((state[key] as Row[]|undefined)||[]).filter(x=>!x.demo&&!String(x.text||"").startsWith("SAMPLE · "));
    const sampleClientIds=new Set(((state.clients as Row[])||[]).filter(x=>x.demo).map(x=>x.id));
    const sampleAccountIds=new Set(((state.accounts as Row[])||[]).filter(x=>x.demo).map(x=>x.id));
    if(keep("accounts").some(x=>sampleClientIds.has(x.clientId))||keep("payments").some(x=>sampleClientIds.has(x.clientId)||sampleAccountIds.has(x.accountId))||keep("topups").some(x=>sampleClientIds.has(x.clientId)||sampleAccountIds.has(x.accountId))){setError("Some real records are linked to samples. Review them before removing the examples.");return;}
    const next:State={...state,demoWorkspace:false};collections.forEach(key=>{next[key]=keep(key)});
    next.accessGrants=(state.accessGrants||[]).filter(g=>g.role==="client"?!sampleClientIds.has(g.clientId):keep("managers").some(m=>m.name===g.managerName));
    await persistState(next);
  }
  async function save(){
    const email=draft.email.trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(email)){setError("Enter a valid login email.");return;}
    if(draft.role==="client"&&!state?.clients.some(c=>c.id===draft.clientId)){setError("Choose a client record first.");return;}
    if(draft.role==="manager"&&!state?.managers.some(m=>m.name===draft.managerName)){setError("Choose a manager record first.");return;}
    if(draft.role==="manager"&&!(draft.clientIds||[]).length){setError("Assign at least one client to this manager.");return;}
    const entries=state?.accessGrants||[];
    if(entries.some(g=>g.email===email && g.email!==editing)){setError("This email already has access. Edit that entry instead.");return;}
    const previous=entries.find(g=>g.email===editing);
    if((!previous||email!==editing||previous.role!==draft.role||!credentialed.includes(email)||password)&&password.length<12){setError("Set a password of at least 12 characters for this login.");return;}
    if(password){
      setBusy(true);setError("");
      try{const res=await fetch("/api/access/credential",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,role:draft.role,password})});const json=await res.json() as {error?:string};if(!res.ok)throw new Error(json.error||"Could not save login.");}
      catch(e){setError(e instanceof Error?e.message:"Could not save login.");setBusy(false);return;}
      setCredentialed(v=>[...new Set([...v,email])]);
      setBusy(false);
    }
    const safe = {...draft,email,clientIds:draft.role==="manager"?(draft.clientIds||[]).filter(id=>state?.clients.some(c=>c.id===id)):[],permissions:draft.permissions.filter(p=>draft.role==="manager"||p!=="clients")};
    await persist([...entries.filter(g=>g.email!==editing),safe]);
  }
  function edit(grant:Grant){setDraft({...grant,clientIds:[...(grant.clientIds||[])],permissions:[...grant.permissions]});setPassword("");setEditing(grant.email);window.scrollTo({top:0,behavior:"smooth"});}
  async function toggle(grant:Grant){await persist((state?.accessGrants||[]).map(g=>g.email===grant.email?{...g,active:!g.active}:g));}
  const grants=state?.accessGrants||[];
  async function logout(){await fetch("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"}});window.location.assign("/login");}
  return <main className="access-shell">
    <header className="access-header"><a href="/" className="access-back">← CRM Admin</a><img src="/logo-green.png" alt="Adsolution"/><button className="access-signout" type="button" onClick={logout}>Sign out</button></header>
    <div className="access-head"><span className="access-eyebrow">ADMIN CONTROL</span><h1>People & access</h1><p>Create a separate CRM login for each client or manager. Choose the sections they can open and assign the clients each manager handles.</p></div>
    {error&&<div className="access-error" role="alert">{error}</div>}
    <div className="access-grid"><section className="access-card">
      <div className="access-card-title"><h2>{editing?"Edit access":"Add access"}</h2><span>{grants.filter(g=>g.active).length} active</span></div>
      <div className="access-switch"><button type="button" className={draft.role==="client"?"selected":""} onClick={()=>chooseRole("client")}>Client</button><button type="button" className={draft.role==="manager"?"selected":""} onClick={()=>chooseRole("manager")}>Manager</button></div>
      <label>Link to {draft.role} record<select value={draft.role==="client"?draft.clientId||"":draft.managerName||""} onChange={e=>chooseEntity(e.target.value)}><option value="">Choose {draft.role}</option>{(draft.role==="client"?state?.clients:state?.managers)?.map(e=><option key={e.id} value={draft.role==="client"?e.id:e.name}>{e.business||e.name}</option>)}</select></label>
      <label>Login email<input type="email" autoComplete="off" value={draft.email} onChange={e=>setDraft(d=>({...d,email:e.target.value}))} placeholder="name@example.com"/></label>
      <label>{editing?"New password (leave blank to keep current)":"Password for this login"}<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 12 characters"/></label>
      {draft.role==="manager"&&<><div className="access-section-title">Assigned clients</div><div className="access-permissions">{(state?.clients||[]).map(c=><label key={c.id} className="access-check"><input type="checkbox" checked={(draft.clientIds||[]).includes(c.id)} onChange={e=>setDraft(d=>({...d,clientIds:e.target.checked?[...(d.clientIds||[]),c.id]:(d.clientIds||[]).filter(id=>id!==c.id)}))}/><span>{c.business||c.name}</span></label>)}</div></>}
      <div className="access-section-title">Allowed sections</div><div className="access-permissions">{sections.filter(([key])=>draft.role==="manager"||key!=="clients").map(([key,label])=><label key={key} className="access-check"><input type="checkbox" checked={draft.permissions.includes(key)} onChange={e=>setDraft(d=>({...d,permissions:e.target.checked?[...d.permissions,key]:d.permissions.filter(p=>p!==key)}))}/><span>{label}</span></label>)}</div>
      <div className="access-actions"><button type="button" className="access-primary" onClick={save} disabled={busy||!state}>{busy?"Saving…":editing?"Save changes":"Give access"}</button>{editing&&<button type="button" onClick={()=>chooseRole("client")}>Cancel</button>}</div>
      <p className="access-help">Passwords are stored as salted hashes. Existing passwords cannot be viewed; enter a new one to reset a login. Managers see only the clients checked above. Clients see only their own records.</p>
    </section><section className="access-card">
      <div className="access-card-title"><h2>People with access</h2><button type="button" onClick={load}>Refresh</button></div>
      {!state?<p className="access-muted">Loading…</p>:grants.length?grants.map(g=><article className="access-person" key={g.email}><div><div className="access-person-name"><strong>{g.role==="client"?state.clients.find(c=>c.id===g.clientId)?.business:state.managers.find(m=>m.name===g.managerName)?.name}</strong><span className={g.active&&credentialed.includes(g.email)?"access-active":"access-disabled"}>{!credentialed.includes(g.email)?"Set password":g.active?"Active":"Disabled"}</span></div><p>{g.email} · {g.role} · {g.role==="manager"?`${g.clientIds?.length||0} clients · `:""}{g.permissions.length} sections</p></div><div><button type="button" onClick={()=>edit(g)}>Edit</button><button type="button" onClick={()=>toggle(g)} disabled={busy}>{g.active?"Disable":"Enable"}</button>{g.active&&<a className="access-preview-link" href={`/portal/${g.role}?previewEmail=${encodeURIComponent(g.email)}`}>Preview</a>}</div></article>):<div className="access-empty">No manager or client has access yet. Add one on the left.</div>}
      <div className="access-instructions"><h3>Share the login</h3><p>Give the person their email, temporary password, and role link through your own secure channel. No automatic email is sent. They can sign in directly without ChatGPT.</p><button type="button" onClick={()=>{void navigator.clipboard.writeText(`${location.origin}/login`);}}>Copy login link</button></div>
      {state?.demoWorkspace&&<div className="access-instructions"><h3>Sample workspace</h3><p>All records marked SAMPLE are fictional. Preview what each role sees before granting access. Preview is read only.</p><div className="access-preview-actions">{state.clients[0]&&<a href={`/portal/client?previewRole=client&target=${encodeURIComponent(state.clients[0].id)}`}>Preview as Client</a>}{state.managers[0]&&<a href={`/portal/manager?previewRole=manager&target=${encodeURIComponent(state.managers[0].name||"")}`}>Preview as Manager</a>}</div><button type="button" onClick={clearSamples} disabled={busy}>Remove sample data</button></div>}
    </section></div>
  </main>;
}
