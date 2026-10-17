'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try { const supabase=createClient(); const {error:signInError}=await supabase.auth.signInWithPassword({email:email.trim(),password}); if(signInError) throw signInError; router.replace('/'); router.refresh(); }
    catch(e) { setError(e instanceof Error?e.message:'Unable to sign in. Check your details and try again.'); }
    finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-card"><div className="login-brand"><div className="crest">SM</div><div><strong>SAINT MONICA'S</strong><span>TEACHERS TRAINING COLLEGE</span></div></div><p className="eyebrow">COLLEGE MANAGEMENT SYSTEM</p><h1>Welcome back</h1><p className="muted">Sign in with the account created for you by the college administrator.</p><form onSubmit={submit} className="login-form"><label>Email address<input autoComplete="username" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>Password<input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>{error&&<p role="alert" className="error-message">{error}</p>}<button disabled={busy} type="submit">{busy?'Signing in…':'Sign in securely'}</button></form><p className="login-foot">Access is managed through Supabase Auth and college role permissions.</p></section></main>;
}
