"use client";
import { useState } from "react";
export default function AuthForm({next}:{next:string}){
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{
    const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,next})});
    const json=await res.json() as {error?:string;redirect?:string};if(!res.ok)throw new Error(json.error||"Login failed.");window.location.assign(json.redirect||"/");
  }catch(e){setError(e instanceof Error?e.message:"Login failed.");setBusy(false)}}
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><img src="/logo-green.png" alt="Adsolution"/><span className="auth-kicker">SECURE WORKSPACE</span><h1>Sign in to your CRM</h1><p>Use the email and password your agency admin gave you.</p><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>{error&&<div role="alert" className="auth-error">{error}</div>}<button type="submit" disabled={busy}>{busy?"Signing in…":"Sign in"}</button><small>First-time Admin? <a href="/setup">Set up your CRM password</a></small></form></main>;
}
