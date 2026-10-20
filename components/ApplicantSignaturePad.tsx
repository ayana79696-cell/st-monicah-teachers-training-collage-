'use client';
import {useRef,useState} from 'react';

export default function ApplicantSignaturePad({onSignature}:{onSignature:(file:File|null)=>void}) {
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const [signed,setSigned]=useState(false);
 function coords(e:React.PointerEvent<HTMLCanvasElement>){const canvas=canvasRef.current!;const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
 function start(e:React.PointerEvent<HTMLCanvasElement>){const canvas=canvasRef.current;if(!canvas)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);const ctx=canvas.getContext('2d');if(!ctx)return;const p=coords(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#24151b';}
 function move(e:React.PointerEvent<HTMLCanvasElement>){const canvas=canvasRef.current;if(!canvas||!canvas.hasPointerCapture(e.pointerId))return;e.preventDefault();const ctx=canvas.getContext('2d');if(!ctx)return;const p=coords(e);ctx.lineTo(p.x,p.y);ctx.stroke();setSigned(true);}
 function save(){const canvas=canvasRef.current;if(!canvas||!signed)return;canvas.toBlob(blob=>{if(blob)onSignature(new File([blob],'applicant-signature.png',{type:'image/png'}));},'image/png');}
 function clear(){const canvas=canvasRef.current;canvas?.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);setSigned(false);onSignature(null);}
 return <div className="signature-area"><p>Sign in the box using your mouse, touchpad, or finger. This signature will be attached to your application.</p><canvas ref={canvasRef} width={700} height={160} aria-label="Applicant signature pad" onPointerDown={start} onPointerMove={move} onPointerUp={save} onPointerCancel={save} style={{width:'100%',maxWidth:700,height:160,touchAction:'none',border:'1px solid #b9a5aa',borderRadius:8,background:'#fff',display:'block',cursor:'crosshair'}}/><div className="signature-actions"><span>{signed?'Signature captured':'Signature required'}</span><button type="button" onClick={clear}>Clear signature</button></div></div>;
}
