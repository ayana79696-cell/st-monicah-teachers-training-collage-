import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ROLES = [
  'principal', 'registrar', 'hod', 'lecturer', 'finance', 'librarian',
  'hostel_manager', 'student', 'practice_supervisor', 'hr',
  'procurement_officer', 'ict_admin',
] as const;

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const ownOrigin = new URL(request.url).origin;
  if (origin && origin !== ownOrigin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey) {
    return NextResponse.json({ error: 'Supabase is not configured for account invitations.' }, { status: 503 });
  }
  if (!serviceKey) {
    return NextResponse.json({
      error: 'Secure invitations are not configured yet. Add SUPABASE_SERVICE_ROLE_KEY as an encrypted server-only Vercel environment variable, then redeploy.',
      configurationRequired: true,
    }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }

  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.full_name || '').trim();
  const role = String(body.role || '');
  const phone = String(body.phone || '').trim();
  const department = String(body.department || '').trim();
  const studentId = String(body.student_id || '').trim() || null;
  const staffId = String(body.staff_id || '').trim() || null;
  const password = String(body.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid college email address.' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) return NextResponse.json({ error: 'Set an initial password between 8 and 128 characters.' }, { status: 400 });
  if (fullName.length < 2 || fullName.length > 160) {
    return NextResponse.json({ error: 'Enter the person’s full name.' }, { status: 400 });
  }
  if (!(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: 'Choose an allowed role. Super Administrator accounts must be provisioned separately.' }, { status: 400 });
  }
  if (role === 'hod' && !department) {
    return NextResponse.json({ error: 'Department is required for a Head of Department account.' }, { status: 400 });
  }
  if (role === 'student' && !studentId) {
    return NextResponse.json({ error: 'Choose the student record that belongs to this account.' }, { status: 400 });
  }
  
  const cookieStore = await cookies();
  const callerClient = createServerClient(url, publicKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Component rendering may not permit cookie writes. */ }
      },
    },
  });

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return NextResponse.json({ error: 'Sign in with your college administrator account first.' }, { status: 401 });
  }
  const { data: callerProfile, error: profileError } = await callerClient
    .from('college_profiles')
    .select('role,active')
    .eq('id', caller.id)
    .maybeSingle();

  if (profileError || callerProfile?.role !== 'super_admin' || !callerProfile.active) {
    return NextResponse.json({ error: 'Only an active Super Administrator can invite college accounts.' }, { status: 403 });
  }

  const admin = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (role === 'student' && studentId) {
    const { data: existing } = await admin.from('college_profiles').select('id').eq('student_id', studentId).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'That student record is already linked to a login account.' }, { status: 409 });
    }
    const { data: student } = await admin.from('college_students').select('id').eq('id', studentId).maybeSingle();
    if (!student) return NextResponse.json({ error: 'The selected student record was not found.' }, { status: 400 });
  }

  if (staffId) {
    const { data: staff, error: staffError } = await admin
      .from('college_staff').select('id,profile_id,employment_status').eq('id', staffId).maybeSingle();
    if (staffError || !staff) return NextResponse.json({ error: 'The selected staff record was not found.' }, { status: 400 });
    if (staff.profile_id) return NextResponse.json({ error: 'That staff record is already linked to an account.' }, { status: 409 });
    if (staff.employment_status !== 'active') {
      return NextResponse.json({ error: 'Only active staff records can be invited as lecturers.' }, { status: 400 });
    }
  }

  const { data: created, error: inviteError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, department: department || null } });
  if (inviteError || !created.user) {
    return NextResponse.json({
      error: inviteError?.message || 'Supabase did not return a new invited account. Check whether the email is already registered and whether Supabase email delivery/redirects are configured.',
    }, { status: 400 });
  }

  const newUserId = created.user.id;
  const { error: insertProfileError } = await admin.from('college_profiles').insert({
    id: newUserId,
    full_name: fullName,
    phone: phone || null,
    role,
    department: department || null,
    active: true,
    student_id: role === 'student' ? studentId : null,
  });
  if (insertProfileError) {
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: 'The account invitation was created but the college profile could not be saved, so the invited account was rolled back. ' + insertProfileError.message }, { status: 500 });
  }

  if (staffId) {
    const { data: linkedStaff, error: linkError } = await admin.from('college_staff').update({ profile_id: newUserId }).eq('id', staffId).is('profile_id', null).select('id').maybeSingle();
    if (linkError || !linkedStaff) {
      await admin.from('college_profiles').delete().eq('id', newUserId);
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: 'Could not link the lecturer to the selected active staff record, so the invitation was rolled back. ' + (linkError?.message || 'That staff record was linked to another account while the invitation was being created.') }, { status: 500 });
    }
  }

  await admin.from('college_audit_log').insert({
    actor_id: caller.id,
    action: 'invite',
    entity_table: 'college_profiles',
    entity_id: newUserId,
    details: { operation: 'invite', role, source: 'super_admin_created_login' },
  });

  return NextResponse.json({
    ok: true,
    message: 'Login created for ' + email + '. The selected role and college profile are saved.',
    user: { id: newUserId, full_name: fullName, email, role },
  });
}
