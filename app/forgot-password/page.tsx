'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const crest = 'https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/update-password',
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error
        ? e.message
        : 'Unable to request password recovery. Check the configured Supabase redirect URLs and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-utility-shell">
    <section className="auth-utility-card">
      <a href="/login" className="auth-utility-brand"><img src={crest} alt="St. Monicah crest"/><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a>
      <p className="eyebrow">ACCOUNT RECOVERY</p>
      <h1>Reset your password.</h1>
      {sent ? <>
        <div className="auth-utility-success" role="status"><strong>Check your email.</strong><p>If an active college account matches that address, Supabase will send a password-recovery link. Follow the email link to set a new password.</p></div>
        <p className="muted">If the message does not arrive, check spam and ask the college administrator to confirm the account and the approved redirect URL.</p>
        <button className="primary-button auth-utility-full" onClick={() => router.replace('/login')}>Return to login</button>
      </> : <>
        <p className="muted">Enter the email address used by your college account. Public registration is disabled; only existing authorized accounts can sign in.</p>
        <form className="auth-utility-form" onSubmit={submit}>
          <label htmlFor="recovery-email">College account email<input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@college.edu"/></label>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="primary-button auth-utility-full" type="submit" disabled={busy}>{busy ? 'Requesting recovery…' : 'Send password-recovery link'}</button>
        </form>
      </>}
      <p className="auth-utility-foot"><a href="/login">Back to secure login</a></p>
    </section>
  </main>;
}
