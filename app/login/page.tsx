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

  return <main className="login-shell login-layout">
    <section className="login-visual">
      <div className="visual-brand">
        <img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teacher’s Training College crest" />
        <div><strong>SAINT MONICA'S</strong><span>TEACHERS TRAINING COLLEGE</span></div>
      </div>
      <div className="visual-message">
        <p className="eyebrow light">EDUCATION MANAGEMENT, REIMAGINED</p>
        <h2>Every part of campus.<br /><em>In harmony.</em></h2>
        <p>A modern, connected workspace for the people, programmes and progress that make Saint Monica’s special.</p>
        <div className="visual-pills"><span>Admissions</span><span>Academics</span><span>Teaching practice</span></div>
      </div>
      <div className="visual-seal"><span className="seal-ring">SM</span><span>LEARNING · SERVICE · EXCELLENCE</span></div>
      <div className="visual-foot"><span className="live-dot"></span> A secure workspace built around your college</div>
    </section>
    <section className="login-card">
      <div className="login-kicker"><span className="secure-glyph">✦</span><span>SAINT MONICA'S · ADMIN PORTAL</span></div>
      <p className="eyebrow">WELCOME BACK</p>
      <h1>Sign in to your workspace</h1>
      <p className="muted">Use your Super Administrator account to continue securely.</p>
      <form onSubmit={submit} className="login-form">
        <label>Super Administrator email<input type="email" value={SUPER_ADMIN_EMAIL} readOnly aria-readonly="true" /></label>
        <label>Password<input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        {error && <p role="alert" className="error-message">{error}</p>}
        <button disabled={busy} type="submit">{busy ? 'Please wait…' : 'Sign in securely'} <span aria-hidden="true">↗</span></button>
      </form>
      <p className="login-foot"><span className="lock-mark">⌑</span> Your password is handled securely by Supabase Auth.</p>
    </section>
  </main>;
}
