'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const crest = 'https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    if (password.length < 10) { setError('Use at least 10 characters for the new password.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setNotice('Your password has been updated. Sign in using the new password.');
      setTimeout(() => router.replace('/login'), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update your password. Request a fresh recovery email and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-utility-shell">
    <section className="auth-utility-card">
      <a href="/login" className="auth-utility-brand"><img src={crest} alt="St. Monicah crest"/><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a>
      <p className="eyebrow">SECURE ACCOUNT RECOVERY</p>
      <h1>Choose a new password.</h1>
      {notice ? <div className="auth-utility-success" role="status"><strong>Password updated.</strong><p>{notice}</p></div> : !ready ? <>
        <p className="muted">This page needs a valid Supabase password-recovery link. Open the most recent link from your college account email.</p>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button auth-utility-full" onClick={() => router.replace('/forgot-password')}>Request a new recovery link</button>
      </> : <form className="auth-utility-form" onSubmit={submit}>
        <label htmlFor="new-password">New password<input id="new-password" type="password" minLength={10} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 10 characters"/></label>
        <label htmlFor="confirm-password">Confirm new password<input id="confirm-password" type="password" minLength={10} autoComplete="new-password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter it again"/></label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button auth-utility-full" type="submit" disabled={busy}>{busy ? 'Updating password…' : 'Update password'}</button>
      </form>}
      <p className="auth-utility-foot"><a href="/login">Back to secure login</a></p>
    </section>
  </main>;
}
