'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const SUPER_ADMIN_EMAIL = 'superadmin@stmonicah.com';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: SUPER_ADMIN_EMAIL,
        password,
      });
      if (signInError) throw signInError;
      router.replace('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in. Check your password and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell"><section className="login-card">
    <div className="login-brand"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teacher’s Training College crest" /><div><strong>SAINT MONICA'S</strong><span>TEACHERS TRAINING COLLEGE</span></div></div>
    <p className="eyebrow">COLLEGE MANAGEMENT SYSTEM</p>
    <h1>Welcome back</h1>
    <p className="muted">Sign in to your Saint Monica’s Super Administrator account.</p>
    <form onSubmit={submit} className="login-form">
      <label>Super Administrator email<input type="email" value={SUPER_ADMIN_EMAIL} readOnly aria-readonly="true" /></label>
      <label>Password<input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      {error && <p role="alert" className="error-message">{error}</p>}
      <button disabled={busy} type="submit">{busy ? 'Please wait…' : 'Sign in securely'}</button>
    </form>
    <p className="login-foot">Your password is handled securely by Supabase Auth.</p>
  </section></main>;
}
