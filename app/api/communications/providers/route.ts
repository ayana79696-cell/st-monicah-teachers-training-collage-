import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return NextResponse.json({ error: 'Supabase server authentication is not configured.' }, { status: 503 });
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(values) {
          try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        }
      }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in to view integration readiness.' }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from('college_profiles')
      .select('role,active').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active || !['super_admin', 'principal'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only the Super Administrator or Principal can view provider configuration.' }, { status: 403 });
    }
    const has = (...keys: string[]) => keys.every(key => Boolean(process.env[key]?.trim()));
    return NextResponse.json({
      providers: {
        sms: { name: "Africa's Talking", configured: has('AT_USERNAME', 'AT_API_KEY'), senderConfigured: has('AT_SENDER_ID'), testMode: process.env.AT_ENVIRONMENT !== 'production' },
        email: { name: 'Resend', configured: has('RESEND_API_KEY', 'EMAIL_FROM'), domainConfigured: has('EMAIL_FROM') },
        whatsapp: { name: 'WhatsApp Cloud API', configured: has('WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET'), webhookConfigured: has('WHATSAPP_WEBHOOK_URL') },
        webhooks: { smsCallbackConfigured: has('SMS_CALLBACK_SECRET'), publicBaseUrlConfigured: has('NEXT_PUBLIC_APP_URL') }
      },
      note: 'This endpoint reports whether environment variables are present. It does not send test messages or prove provider credentials are valid.'
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to check communication integration readiness.' }, { status: 500 });
  }
}
