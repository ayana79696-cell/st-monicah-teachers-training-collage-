import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const configured=(keys:string[])=>keys.every(k=>!!String(process.env[k]||'').trim());
export async function GET(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const bearer=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!url||!key||!bearer)return NextResponse.json({error:'Sign in with an active college account.'},{status:401});
 const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+bearer}}});
 const {data:{user},error:authError}=await db.auth.getUser(bearer);
 if(authError||!user)return NextResponse.json({error:'Your session is invalid.'},{status:401});
 const {data:profile,error}=await db.from('college_profiles').select('role,active').eq('id',user.id).maybeSingle();
 if(error||!profile?.active||!['super_admin','principal','ict_admin'].includes(profile.role))return NextResponse.json({error:'Integration settings are restricted to active Super Administrator, Principal and ICT Admin accounts.'},{status:403});
 const base=(process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:'https://st-monicah-teachers-training-collage-francis9271057-3716.vercel.app');
 const smsToken=process.env.SMS_CALLBACK_TOKEN||'';
 const mpesaToken=process.env.MPESA_CALLBACK_TOKEN||'';
 return NextResponse.json({
  supabase:{configured:configured(['NEXT_PUBLIC_SUPABASE_URL'])&&configured(['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])},
  mpesa:{configured:configured(['MPESA_CONSUMER_KEY','MPESA_CONSUMER_SECRET','MPESA_SHORTCODE','MPESA_PASSKEY','MPESA_CALLBACK_URL','MPESA_CALLBACK_TOKEN']),environment:process.env.MPESA_ENV||'sandbox',required:['MPESA_CONSUMER_KEY','MPESA_CONSUMER_SECRET','MPESA_SHORTCODE','MPESA_PASSKEY','MPESA_CALLBACK_URL','MPESA_CALLBACK_TOKEN'],callbackUrl:profile.role==='super_admin'&&mpesaToken?base+'/api/payments/mpesa/callback?token='+encodeURIComponent(mpesaToken):base+'/api/payments/mpesa/callback'},
  sms:{configured:configured(['AFRICASTALKING_USERNAME','AFRICASTALKING_API_KEY','SMS_CALLBACK_TOKEN']),senderConfigured:!!process.env.AFRICASTALKING_SENDER_ID,required:['AFRICASTALKING_USERNAME','AFRICASTALKING_API_KEY'],deliveryReportUrl:profile.role==='super_admin'&&smsToken?base+'/api/communications/delivery-report?token='+encodeURIComponent(smsToken):base+'/api/communications/delivery-report'},
  email:{configured:configured(['RESEND_API_KEY','RESEND_FROM']),required:['RESEND_API_KEY','RESEND_FROM']},
  ai:{configured:configured(['OPENAI_API_KEY']),model:process.env.OPENAI_MODEL||'gpt-4.1-mini',required:['OPENAI_API_KEY']},
  dailyChecks:{configured:configured(['CRON_SECRET']),schedule:'Daily around 08:00 Africa/Nairobi; Vercel timing may vary within the configured hour.'},
  updatedAt:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
