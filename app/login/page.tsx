'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const SUPER_ADMIN_EMAIL = 'superadmin@stmonicah.com';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const supabase = createClient();
      if (mode === 'signup') {
        if (password.length < 10) throw new Error('Choose a password with at least 10 characters.');
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: SUPER_ADMIN_EMAIL,
          password,
          options: { data: { full_name: 'Saint Monica’s Super Administrator' } },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.replace('/');
          router.refresh();
          return;
        }
        setNotice('Your account request has been created. Check superadmin@stmonicah.com for the verification email, verify it, then return here and choose “Sign in”.');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: SUPER_ADMIN_EMAIL,
          password,
        });
        if (signInError) throw signInError;
        router.replace('/');
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to continue. Check the details and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell"><section className="login-card">
    <div className="login-brand"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teacher’s Training College crest" /><div><strong>SAINT MONICA'S</strong><span>TEACHERS TRAINING COLLEGE</span></div></div>
    <p className="eyebrow">COLLEGE MANAGEMENT SYSTEM</p>
    <h1>{mode === 'signup' ? 'Create your Super Admin login' : 'Welcome back'}</h1>
    <p className="muted">{mode === 'signup' ? 'Create the first administrator login using your own password. This email is reserved for the college Super Administrator.' : 'Sign in to your Saint Monica’s Super Administrator account.'}</p>
    <div className="login-form">
      <label>Super Administrator email<input type="email" value={SUPER_ADMIN_EMAIL} readOnly aria-readonly="true" /></label>
      <form onSubmit={submit} className="login-form">
        <label>Password<input autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={mode === 'signup' ? 10 : 1} /></label>
        {mode === 'signup' && <label>Confirm your password<input autoComplete="new-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={10} /></label>}
        {error && <p role="alert" className="error-message">{error}</p>}
        {notice && <p role="status" className="success-message">{notice}</p>}
        <button disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create Super Admin account' : 'Sign in securely'}</button>
      </form>
    </div>
    <p className="login-foot">{mode === 'signup' ? 'Use a strong, unique password and keep it private. First-time setup can be claimed only once.' : 'Your password is handled securely by Supabase Auth.'}</p>
    <button type="button" className="quiet-button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setNotice(''); setPassword(''); setConfirmPassword(''); }}>{mode === 'signup' ? 'Already created the account? Sign in' : 'First time here? Create Super Admin account'}</button>
  </section></main>;
}
