"use client";
import { useState } from "react";
export default function SetupForm({email}:{email:string}){
  const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();if(password!==confirm){setError("Passwords do not match.");return}setBusy(true);setError("");try{
    const res=await fetch("/api/auth/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const json=await res.json() as {error?:string;redirect?:string};if(!res.ok)throw new Error(json.error);window.location.assign(json.redirect||"/");
  }catch(e){setError(e instanceof Error?e.message:"Setup failed.");setBusy(false)}}
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><img src="/logo-green.png" alt="Adsolution"/><span className="auth-kicker">ONE-TIME ADMIN SETUP</span><h1>Create your CRM password</h1><p>Owner verified: {email}. After this, sign in directly with this email and password.</p><label>Password (at least 12 characters)<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<div className="auth-error" role="alert">{error}</div>}<button disabled={busy}>{busy?"Setting up…":"Create Admin login"}</button></form></main>;
}
