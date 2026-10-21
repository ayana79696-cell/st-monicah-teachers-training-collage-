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

  return <main className="login-shell login-layout futuristic-login">
    <div className="login-atmosphere" aria-hidden="true">
      <div className="orbit orbit-one"><span /></div>
      <div className="orbit orbit-two"><span /></div>
      <div className="orb orb-gold" />
      <div className="orb orb-wine" />
      <div className="orb orb-small" />
      <div className="grid-horizon" />
    </div>
    <section className="login-visual">
      <div className="visual-brand">
        <img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teachers Training College crest" />
        <div><strong>ST. MONICAH</strong><span>TEACHERS TRAINING COLLEGE</span></div>
      </div>
      <div className="visual-message">
        <p className="eyebrow light">THE NEXT GENERATION OF COLLEGE MANAGEMENT</p>
        <h2>One campus.<br /><em>Infinite possibilities.</em></h2>
        <p>Bring people, learning, finance, and administration together in one intelligent workspace built for St. Monicah.</p>
        <div className="visual-pills"><span>Academics</span><span>Finance</span><span>Student life</span></div>
      </div>
      <div className="visual-feature" aria-hidden="true">
        <div className="feature-ring"><div className="feature-core"><img src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="" /></div></div>
        <div className="feature-caption"><span className="feature-dot" /> COLLEGE ERP <b>·</b> SECURE ACCESS</div>
      </div>
      <div className="visual-foot"><span className="live-dot" /> A smarter way to move your college forward</div>
    </section>
    <section className="login-card futuristic-card">
      <div className="login-kicker"><span className="secure-glyph">✦</span><span>ST. MONICAH <i>/</i> SECURE PORTAL</span><span className="secure-status"><b /> SECURE</span></div>
      <div className="login-card-crest"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="" /></div>
      <p className="eyebrow">WELCOME BACK</p>
      <h1>Enter your workspace.</h1>
      <p className="muted">Sign in with your Super Administrator credentials to continue.</p>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="admin-email">Administrator email<input id="admin-email" type="email" value={SUPER_ADMIN_EMAIL} readOnly aria-readonly="true" /></label>
        <label htmlFor="admin-password">Password<input id="admin-password" name="password" autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required /></label>
        {error && <p role="alert" className="error-message">{error}</p>}
        <button disabled={busy} type="submit">{busy ? 'Authenticating…' : 'Access your workspace'} <span aria-hidden="true">↗</span></button>
      </form>
      <div className="login-trust"><span>✧</span> Protected by Supabase authentication</div>
      <p className="login-foot">ST. MONICAH TEACHERS TRAINING COLLEGE <span>·</span> AUTHORIZED USERS ONLY</p>
    </section>
    <div className="login-copyright">© {new Date().getFullYear()} St. Monicah Teachers Training College</div>
  </main>;
}
