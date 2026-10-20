import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 1_000_000) {
      return NextResponse.json({ error: 'Application details are too large to submit.' }, { status: 413 });
    }

    const body = await request.json();
    const application = body?.application;

    if (
      !application ||
      typeof application !== 'object' ||
      typeof application.first_name !== 'string' ||
      typeof application.last_name !== 'string' ||
      typeof application.phone !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Please complete the required applicant details and try again.' },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
    const legacyAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const supabaseKey = legacyAnonKey ?? publishableKey;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Admissions submission endpoint is missing Supabase public configuration.');
      return NextResponse.json(
        { error: 'The college application service is not configured. Please contact admissions.' },
        { status: 503 },
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);

    let upstream: Response;
    try {
      upstream = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_college_admission`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          ...(legacyAnonKey ? { Authorization: `Bearer ${legacyAnonKey}` } : {}),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ p_application: application }),
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return NextResponse.json(
          { error: 'The admissions database took too long to respond. Check the Admissions Desk before submitting again.' },
          { status: 504 },
        );
      }
      console.error('Admissions database request failed:', error);
      return NextResponse.json(
        { error: 'Could not reach the admissions database. Check your connection and try again.' },
        { status: 502 },
      );
    } finally {
      clearTimeout(timer);
    }

    const result = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const message =
        typeof result?.message === 'string'
          ? result.message
          : 'The application could not be saved. Please check the details and try again.';
      console.error('Admissions database rejected an application:', upstream.status, message);
      return NextResponse.json({ error: message }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 });
    }

    if (!result || typeof result.tracking_token !== 'string' || result.tracking_token.length < 40) {
      console.error('Admissions database returned an incomplete submission response.');
      return NextResponse.json(
        { error: 'The application service did not return a tracking link. Please contact admissions before submitting again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ data: result }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Admissions submit endpoint failed:', error);
    return NextResponse.json(
      { error: 'Unable to submit the application. Please try again or contact the college.' },
      { status: 400 },
    );
  }
}
