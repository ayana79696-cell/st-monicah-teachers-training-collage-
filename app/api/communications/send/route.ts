import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const managers=['super_admin','principal','registrar'];
const normalPhone=(value:string)=>{
 let valueDigits=value.replace(/\D/g,'');
 if(valueDigits.startsWith('0'))valueDigits='254'+valueDigits.slice(1);
 else if(valueDigits.startsWith('7')||valueDigits.startsWith('1'))valueDigits='254'+valueDigits;
 return valueDigits;
};
const safeError=(v:any)=>String(v?.message||v||'Provider request failed').slice(0,450);

export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:'Request origin is not allowed.'},{status:403});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.json({error:'Supabase is not configured.'},{status:503});
 const bearer=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!bearer)return NextResponse.json({error:'Sign in before sending an external message.'},{status:401});
 let body:any;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid request body.'},{status:400});}
 const messageId=String(body.message_id||'').trim();
 if(!messageId)return NextResponse.json({error:'Message ID is required.'},{status:400});
 const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+bearer}}});
 const {data:{user},error:authError}=await db.auth.getUser(bearer);
 if(authError||!user)return NextResponse.json({error:'Your login session expired. Sign in again.'},{status:401});
 const {data:profile,error:profileError}=await db.from('college_profiles').select('id,role,active').eq('id',user.id).maybeSingle();
 if(profileError||!profile?.active||!managers.includes(profile.role))return NextResponse.json({error:'Only an active Super Administrator, Principal or Registrar can send college-wide messages.'},{status:403});
 const {data:message,error:messageError}=await db.from('college_messages').select('id,audience,subject,message_body,channel,status,programme_id,recipient_profile_id').eq('id',messageId).maybeSingle();
 if(messageError||!message)return NextResponse.json({error:'Message not found or inaccessible.'},{status:404});
 if(!['sms','email'].includes(message.channel))return NextResponse.json({error:'This endpoint sends SMS/email only. Publish in-app announcements in the Communications page.'},{status:400});
 if(message.status!=='queued')return NextResponse.json({error:'Only queued messages may be sent. Save or queue the message again if it is still a draft.'},{status:409});
 const atUser=process.env.AFRICASTALKING_USERNAME;
 const atKey=process.env.AFRICASTALKING_API_KEY;
 const atSender=process.env.AFRICASTALKING_SENDER_ID;
 const resendKey=process.env.RESEND_API_KEY;
 const resendFrom=process.env.RESEND_FROM;
 if(message.channel==='sms'&&(!atUser||!atKey))return NextResponse.json({error:'SMS provider is not configured. Set AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY in encrypted Vercel environment variables. Configure an approved sender ID if required.'},{status:503});
 if(message.channel==='email'&&(!resendKey||!resendFrom))return NextResponse.json({error:'Email provider is not configured. Set RESEND_API_KEY and RESEND_FROM in encrypted Vercel environment variables.'},{status:503});
 const {data:prior,error:priorError}=await db.from('college_message_deliveries').select('id').eq('message_id',messageId).limit(1);
 if(priorError)return NextResponse.json({error:'Could not check the existing delivery history.'},{status:500});
 if((prior||[]).length)return NextResponse.json({error:'This message already has delivery attempts. Refresh the message history and do not send it again to avoid duplicate messages.'},{status:409});
 type Recipient={profileId:string|null;name:string;phone:string|null;email:string|null};
 let recipients:Recipient[]=[];
 if(message.audience==='staff'){
  const {data,error}=await db.from('college_staff').select('profile_id,full_name,phone,email').eq('employment_status','active').limit(100);
  if(error)return NextResponse.json({error:'Could not load approved staff recipients: '+safeError(error)},{status:403});
  recipients=(data||[]).map((r:any)=>({profileId:r.profile_id||null,name:r.full_name||'College staff',phone:r.phone||null,email:r.email||null}));
 }else if(message.audience==='individual'){
  if(profile.role!=='super_admin')return NextResponse.json({error:'Only the Super Administrator can send individual student messages.'},{status:403});
  if(!message.recipient_profile_id)return NextResponse.json({error:'The individual student recipient is missing.'},{status:400});
  const {data:sp,error}=await db.from('college_profiles').select('id,full_name,student_id,active,role').eq('id',message.recipient_profile_id).eq('role','student').eq('active',true).maybeSingle();
  if(error||!sp?.student_id)return NextResponse.json({error:'The selected student login is not linked to a student record.'},{status:400});
  const {data:s,error:se}=await db.from('college_students').select('id,first_name,middle_name,last_name,phone,email,status').eq('id',sp.student_id).maybeSingle();
  if(se||!s)return NextResponse.json({error:'Student contact record is unavailable.'},{status:400});
  recipients=[{profileId:sp.id,name:[s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' '),phone:s.phone||null,email:s.email||null}];
 }else{
  let query=db.from('college_students').select('id,first_name,middle_name,last_name,phone,email,programme_id,status').eq('status','active').limit(100);
  if(message.audience==='programme'){
   if(!message.programme_id)return NextResponse.json({error:'Choose a programme audience before sending.'},{status:400});
   query=query.eq('programme_id',message.programme_id);
  }else if(message.audience!=='all_students')return NextResponse.json({error:'Unsupported message audience.'},{status:400});
  const {data,error}=await query;
  if(error)return NextResponse.json({error:'Could not load student recipients: '+safeError(error)},{status:403});
  recipients=(data||[]).map((r:any)=>({profileId:null,name:[r.first_name,r.middle_name,r.last_name].filter(Boolean).join(' '),phone:r.phone||null,email:r.email||null}));
 }
 const contactKey=message.channel==='sms'?'phone':'email';
 const seen=new Set<string>();
 const targets=recipients.map(r=>({...r,destination:message.channel==='sms'?normalPhone(r.phone||''):(r.email||'').trim().toLowerCase()}))
 .filter(r=>{
  const dest=r.destination;
  if(!dest||seen.has(dest))return false;
  if(message.channel==='sms'&&!/^254[0-9]{9}$/.test(dest))return false;
  if(message.channel==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest))return false;
  seen.add(dest);return true;
 });
 if(!targets.length)return NextResponse.json({error:'No valid '+contactKey+' destinations were found for this audience. Verify student/staff contact records first.'},{status:422});
 if(targets.length>100)return NextResponse.json({error:'This send is limited to 100 recipients at a time. Split larger audiences into smaller groups to control rate limits and delivery errors.'},{status:400});
 const {data:deliveryRows,error:insertError}=await db.from('college_message_deliveries').insert(targets.map(r=>({message_id:message.id,recipient_profile_id:r.profileId,recipient_name:r.name,destination:r.destination,channel:message.channel,status:'queued',provider:message.channel==='sms'?"africas_talking":"resend"}))).select('id,destination');
 if(insertError)return NextResponse.json({error:'Could not create a delivery ledger. This message was not sent. '+safeError(insertError)},{status:409});
 let accepted=0,failed=0,queued=0;
 const outcomes:any[]=[];
 for(const target of targets){
  const row=(deliveryRows||[]).find((d:any)=>d.destination===target.destination);
  if(!row){failed++;continue;}
  try{
   if(message.channel==='sms'){
    const params=new URLSearchParams({username:atUser!,to:target.destination,message:message.message_body});
    if(atSender)params.set('from',atSender);
    const resp=await fetch('https://api.africastalking.com/version1/messaging',{method:'POST',headers:{apiKey:atKey!,'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:params.toString(),cache:'no-store'});
    const result:any=await resp.json().catch(()=>({}));
    const recipient=result?.SMSMessageData?.Recipients?.[0];
    if(!resp.ok||!recipient||!['100','101','102'].includes(String(recipient.statusCode))){
     failed++;await db.from('college_message_deliveries').update({status:'failed',provider_status:String(recipient?.status||recipient?.statusCode||resp.status),error_message:safeError(recipient?.status||result?.SMSMessageData?.Message||resp.statusText)}).eq('id',row.id);
     outcomes.push({destination:target.destination,status:'failed'});continue;
    }
    const state=String(recipient.statusCode)==='101'?'submitted':'queued';
    accepted++;if(state==='queued')queued++;
    await db.from('college_message_deliveries').update({status:state,provider_message_id:recipient.messageId||null,provider_status:String(recipient.status||recipient.statusCode),submitted_at:new Date().toISOString()}).eq('id',row.id);
    outcomes.push({destination:target.destination,status:state});
   }else{
    const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+resendKey!,'Content-Type':'application/json'},body:JSON.stringify({from:resendFrom,to:[target.destination],subject:message.subject,text:message.message_body}),cache:'no-store'});
    const result:any=await resp.json().catch(()=>({}));
    if(!resp.ok||!result.id){failed++;await db.from('college_message_deliveries').update({status:'failed',provider_status:String(resp.status),error_message:safeError(result?.message||result?.error||resp.statusText)}).eq('id',row.id);outcomes.push({destination:target.destination,status:'failed'});continue;}
    accepted++;await db.from('college_message_deliveries').update({status:'submitted',provider_message_id:String(result.id),provider_status:'Provider accepted email request',submitted_at:new Date().toISOString()}).eq('id',row.id);
    outcomes.push({destination:target.destination,status:'submitted'});
   }
  }catch(e:any){
   failed++;await db.from('college_message_deliveries').update({status:'failed',error_message:safeError(e)}).eq('id',row.id);outcomes.push({destination:target.destination,status:'failed'});
  }
 }
 const status=accepted>0?'queued':'failed';
 const note=accepted+' provider-accepted; '+failed+' failed; '+queued+' queued for a retry by the provider. Provider acceptance is not proof of handset delivery. Delivery status updates when a valid callback is received.';
 await db.from('college_messages').update({status,provider_error:note,delivered_at:null}).eq('id',message.id);
 return NextResponse.json({ok:accepted>0,provider:message.channel==='sms'?"africas_talking":"resend",attempted:targets.length,accepted,failed,queued,note,outcomes},{status:accepted>0?200:502,headers:{'Cache-Control':'no-store'}});
}
