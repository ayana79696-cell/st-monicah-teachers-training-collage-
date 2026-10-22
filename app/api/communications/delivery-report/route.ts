import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:NextRequest){
 const expected=process.env.SMS_CALLBACK_TOKEN;
 const supplied=request.nextUrl.searchParams.get('token')||'';
 if(!expected||!supplied||supplied!==expected)return NextResponse.json({ok:false,error:'Unauthorized delivery report.'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.json({ok:false,error:'Delivery report service is not configured.'},{status:503});
 let payload:any={};
 try{
  const type=request.headers.get('content-type')||'';
  if(type.includes('application/json'))payload=await request.json();
  else{const form=await request.formData();for(const [k,v] of form.entries())payload[k]=String(v);}
 }catch{return NextResponse.json({ok:false,error:'Invalid delivery report payload.'},{status:400});}
 const token=expected;
 const providerMessageId=String(payload.id||payload.messageId||payload.message_id||'');
 const recipient=String(payload.phoneNumber||payload.to||payload.recipient||'');
 const status=String(payload.status||payload.deliveryStatus||payload.delivery_status||'');
 const reason=String(payload.failureReason||payload.reason||payload.errorMessage||'');
 if(!status)return NextResponse.json({ok:false,error:'Delivery status is missing.'},{status:400});
 const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.rpc('college_apply_sms_delivery_report',{p_token:token,p_provider_message_id:providerMessageId||null,p_recipient:recipient||null,p_status:status,p_reason:reason||null,p_payload:payload});
 if(error)return NextResponse.json({ok:false,error:'Delivery report could not be matched or authorized.'},{status:500});
 return NextResponse.json({ok:true,result:data});
}
