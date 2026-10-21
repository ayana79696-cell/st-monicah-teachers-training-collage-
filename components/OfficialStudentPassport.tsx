'use client';

import React from 'react';

export type OfficialPassportStudent = {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  admission_number?: string | null;
  intake?: string | null;
  intake_year?: number | string | null;
  passport_photo_url?: string | null;
};

export type OfficialPassportRecord = {
  passport_number?: string | null;
  verification_token?: string | null;
  status?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  photo_url?: string | null;
  authorized_signature_data_url?: string | null;
};

const crest = 'https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';

function displayAdmission(value?: string | null) {
  if (!value) return 'Pending assignment';
  const normalized = value.trim().replace(/^PASS\s*/i, '');
  if (/^\d+$/.test(normalized)) return normalized.padStart(3, '0');
  return value;
}

function displayDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value + (value.length === 10 ? 'T00:00:00' : ''));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-KE');
}

export default function OfficialStudentPassport({
  student,
  passport,
  programmeTitle,
  applicantSignatureUrl: _applicantSignatureUrl,
  officerSignatureUrl,
  photoUrl,
}: {
  student: OfficialPassportStudent;
  passport: OfficialPassportRecord;
  programmeTitle?: string | null;
  applicantSignatureUrl?: string;
  officerSignatureUrl?: string;
  photoUrl?: string | null;
}) {
  const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
  const verificationUrl = typeof window !== 'undefined' && passport.verification_token
    ? window.location.origin + '/verify-passport?token=' + encodeURIComponent(passport.verification_token)
    : '';
  const qrUrl = verificationUrl
    ? 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=2&data=' + encodeURIComponent(verificationUrl)
    : '';
  const portrait = photoUrl || passport.photo_url || student.passport_photo_url || '';
  const active = (passport.status || 'active').toLowerCase() === 'active';
  const signatureImage = passport.authorized_signature_data_url || officerSignatureUrl || '';

  return (
    <>
      <article className="smid-card" aria-label="St. Monicah student identity card">
        <div className="smid-watermark" aria-hidden="true"><img src={crest} alt="" /></div>

        <header className="smid-header">
          <div className="smid-crest-frame"><img src={crest} alt="St. Monicah crest" /></div>
          <div className="smid-heading">
            <strong>ST. MONICAH</strong>
            <span>TEACHERS TRAINING COLLEGE</span>
            <small>OFFICIAL STUDENT IDENTITY</small>
          </div>
          <div className="smid-header-mark" aria-hidden="true"><span>SM</span></div>
        </header>

        <div className="smid-content">
          <div className="smid-portrait">
            {portrait ? <img src={portrait} alt="Student portrait" /> : (
              <div className="smid-photo-placeholder"><span>PHOTO</span><small>Student image</small></div>
            )}
          </div>

          <div className="smid-details">
            <div className="smid-name-block">
              <span className="smid-label">STUDENT NAME</span>
              <h3 title={fullName || 'Student name'}>{fullName || 'Student name'}</h3>
            </div>
            <div className="smid-data-grid">
              <div className="smid-data-item">
                <span className="smid-label">ADMISSION NO.</span>
                <strong>{displayAdmission(student.admission_number)}</strong>
              </div>
              <div className="smid-data-item">
                <span className="smid-label">PASSPORT NO.</span>
                <strong>{passport.passport_number || '—'}</strong>
              </div>
              <div className="smid-data-item smid-course">
                <span className="smid-label">PROGRAMME</span>
                <strong title={programmeTitle || 'Programme not assigned'}>{programmeTitle || 'Programme not assigned'}</strong>
              </div>
              <div className="smid-data-item">
                <span className="smid-label">INTAKE</span>
                <strong>{[student.intake, student.intake_year].filter(Boolean).join(' ') || '—'}</strong>
              </div>
            </div>
          </div>

          <aside className="smid-verification">
            <div className="smid-qr-frame">
              {qrUrl ? <img src={qrUrl} alt="QR code for online passport verification" /> : <span>QR</span>}
            </div>
            <span className="smid-scan-label">SCAN TO VERIFY</span>
            <span className={'smid-state ' + (active ? 'is-active' : 'is-inactive')}>{active ? 'ACTIVE' : 'REVOKED'}</span>
          </aside>
        </div>

        <footer className="smid-footer">
          <div className="smid-official-signature">
            <div className="smid-signature-mark">
              {signatureImage
                ? <img src={signatureImage} alt="Authorized officer signature" />
                : <span className="smid-signature-blank" />}
            </div>
            <span>AUTHORIZED OFFICER</span>
          </div>
          <div className="smid-date">
            <span>ISSUED</span>
            <strong>{displayDate(passport.issued_at)}</strong>
          </div>
          <div className="smid-date smid-validity">
            <span>VALIDITY</span>
            <strong>{passport.expires_at ? 'Until ' + displayDate(passport.expires_at) : 'Until revoked'}</strong>
          </div>
          <div className="smid-footer-rule" />
        </footer>
      </article>

      <style jsx global>{`
        .smid-card{position:relative;isolation:isolate;display:grid;grid-template-rows:22% minmax(0,1fr) 18%;width:100%;max-width:600px;aspect-ratio:1.586;margin:0 auto;overflow:hidden;border:1px solid #d5b76f;border-radius:15px;background:#fffdf8;color:#34212b;box-shadow:0 18px 45px rgba(66,18,37,.14);print-color-adjust:exact;-webkit-print-color-adjust:exact;font-family:'DM Sans',Arial,sans-serif}
        .smid-card *{box-sizing:border-box;min-width:0}
        .smid-watermark{position:absolute;inset:0;z-index:-1;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none}
        .smid-watermark img{width:54%;height:90%;object-fit:contain;opacity:.055;filter:grayscale(1)}
        .smid-header{position:relative;display:flex;align-items:center;gap:clamp(7px,1.5vw,13px);padding:8px 13px;background:linear-gradient(110deg,#35101f 0%,#641c35 68%,#7a2b49 100%);color:#fff;overflow:hidden}
        .smid-crest-frame{display:grid;place-items:center;flex:0 0 auto;width:clamp(30px,6vw,44px);height:clamp(30px,6vw,44px);padding:3px;border-radius:50%;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.18)}
        .smid-crest-frame img{display:block;width:100%;height:100%;object-fit:contain}
        .smid-heading{display:flex;flex:1;flex-direction:column;gap:3px;min-width:0;line-height:1.05}
        .smid-heading strong{font-family:Manrope,'DM Sans',Arial,sans-serif;font-size:clamp(11px,2.15vw,16px);font-weight:800;letter-spacing:.11em}
        .smid-heading span{font-size:clamp(6px,1.05vw,8px);font-weight:700;letter-spacing:.105em}
        .smid-heading small{margin-top:2px;font-size:clamp(5px,.86vw,7px);font-weight:800;letter-spacing:.14em;color:#f4d99a}
        .smid-header-mark{position:absolute;right:-10px;top:-18px;display:grid;place-items:center;width:85px;height:85px;border:1px solid rgba(235,210,150,.22);border-radius:50%;color:rgba(245,222,169,.22);font:800 23px Manrope}
        .smid-content{display:grid;grid-template-columns:23% minmax(0,1fr) 14%;align-items:center;gap:clamp(6px,1.4vw,12px);padding:8px 13px 7px;min-height:0}
        .smid-portrait{align-self:center;width:100%;aspect-ratio:4/5;max-height:100%;overflow:hidden;border:1px solid #d8c6a0;border-radius:6px;background:#f4eddf;box-shadow:0 4px 10px rgba(52,33,43,.09)}
        .smid-portrait>img{display:block;width:100%;height:100%;object-fit:cover}
        .smid-photo-placeholder{display:flex;width:100%;height:100%;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;color:#9f8967}
        .smid-photo-placeholder span{font:800 clamp(7px,1.1vw,10px) Manrope;letter-spacing:.12em}
        .smid-photo-placeholder small{font-size:clamp(5px,.8vw,7px)}
        .smid-details{display:flex;flex-direction:column;justify-content:center;gap:7px;min-width:0;overflow:hidden}
        .smid-label{display:block;margin-bottom:3px;color:#927143;font-size:clamp(5px,.78vw,7px);font-weight:800;letter-spacing:.12em;line-height:1.1}
        .smid-name-block h3{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;margin:0;color:#351426;font:800 clamp(12px,2.35vw,17px)/1.08 Manrope,'DM Sans',Arial,sans-serif;overflow-wrap:anywhere}
        .smid-data-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}
        .smid-data-item{overflow:hidden}
        .smid-data-item strong{display:block;overflow:hidden;color:#402b35;font-size:clamp(7px,1.17vw,9px);font-weight:750;line-height:1.14;text-overflow:ellipsis;overflow-wrap:anywhere}
        .smid-course strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;white-space:normal}
        .smid-verification{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:0}
        .smid-qr-frame{display:grid;place-items:center;width:100%;max-width:82px;aspect-ratio:1;padding:3px;border:1px solid #e8dcc4;border-radius:6px;background:#fff;box-shadow:0 3px 8px rgba(52,33,43,.06)}
        .smid-qr-frame img{display:block;width:100%;height:100%;object-fit:contain}
        .smid-qr-frame>span{font:800 12px Manrope;color:#927143}
        .smid-scan-label{font-size:clamp(4px,.7vw,6px);font-weight:800;letter-spacing:.08em;color:#765d42;text-align:center;white-space:nowrap}
        .smid-state{display:inline-flex;justify-content:center;padding:3px 6px;border-radius:999px;font-size:clamp(5px,.72vw,6px);font-weight:900;letter-spacing:.08em}
        .smid-state.is-active{background:#e6f3e8;color:#28653b}
        .smid-state.is-inactive{background:#fae7e5;color:#a52d2b}
        .smid-footer{position:relative;display:grid;grid-template-columns:1.45fr .65fr .95fr;align-items:center;gap:8px;padding:4px 13px 8px;border-top:1px solid #eadbbd;background:linear-gradient(100deg,#fcf6e9,#f4e7c9)}
        .smid-official-signature,.smid-date{display:flex;flex-direction:column;justify-content:flex-end;gap:3px;min-width:0}
        .smid-signature-mark{display:flex;align-items:flex-end;height:clamp(18px,3.4vw,25px);max-width:100%;overflow:hidden}
        .smid-signature-mark img{display:block;width:auto;max-width:100%;height:100%;object-fit:contain;object-position:left bottom;filter:contrast(1.15)}
        .smid-signature-blank{display:block;width:88%;height:80%;border-bottom:1.2px solid #7f6240}
        .smid-official-signature>span,.smid-date>span{color:#866d49;font-size:clamp(5px,.73vw,6px);font-weight:800;letter-spacing:.1em;line-height:1}
        .smid-date strong{overflow:hidden;color:#412535;font-size:clamp(6px,1vw,8px);font-weight:800;line-height:1.12;text-overflow:ellipsis;white-space:nowrap}
        .smid-footer-rule{position:absolute;right:0;bottom:0;left:0;height:3px;background:linear-gradient(90deg,#641c35,#c6a45b,#641c35)}
        @media(max-width:540px){.smid-card{border-radius:9px}.smid-header{gap:6px;padding:5px 7px}.smid-crest-frame{width:27px;height:27px}.smid-heading strong{font-size:clamp(8px,2.5vw,12px)}.smid-heading span{font-size:clamp(5px,1.45vw,7px)}.smid-heading small{font-size:clamp(4px,1.1vw,6px)}.smid-content{grid-template-columns:22% minmax(0,1fr) 14%;gap:5px;padding:5px 7px}.smid-details{gap:4px}.smid-data-grid{gap:4px 5px}.smid-label{font-size:clamp(4px,1.05vw,6px);letter-spacing:.07em}.smid-name-block h3{font-size:clamp(8px,2.7vw,12px)}.smid-data-item strong{font-size:clamp(5.5px,1.7vw,8px)}.smid-qr-frame{padding:2px}.smid-footer{grid-template-columns:1.35fr .65fr .9fr;gap:5px;padding:4px 7px 7px}.smid-official-signature>span,.smid-date>span{font-size:clamp(4px,1vw,5.5px)}.smid-date strong{font-size:clamp(5px,1.45vw,7px)}}
        @media print{html,body{width:90mm!important;height:60mm!important;margin:0!important;padding:0!important;overflow:hidden!important}body *{visibility:hidden!important}.smid-card,.smid-card *{visibility:visible!important}.smid-card{position:absolute!important;left:0!important;top:0!important;width:85.6mm!important;height:54mm!important;max-width:none!important;aspect-ratio:auto!important;margin:0!important;border-radius:1.5mm!important;box-shadow:none!important;grid-template-rows:22% minmax(0,1fr) 18%!important;overflow:hidden!important}.smid-watermark img{opacity:.065!important}.smid-header{gap:1.5mm!important;padding:1mm 1.5mm!important}.smid-crest-frame{width:8mm!important;height:8mm!important;padding:.5mm!important}.smid-heading strong{font-size:6.3pt!important}.smid-heading span{font-size:3.4pt!important}.smid-heading small{font-size:3pt!important}.smid-content{grid-template-columns:16mm minmax(0,1fr) 10mm!important;gap:1.3mm!important;padding:1.2mm 1.5mm .8mm!important}.smid-details{gap:1mm!important}.smid-portrait{width:15mm!important;height:19mm!important}.smid-label{font-size:3.1pt!important;margin-bottom:.35mm!important}.smid-name-block h3{font-size:6.2pt!important;line-height:1.05!important}.smid-data-grid{gap:1.1mm 1.4mm!important}.smid-data-item strong{font-size:4.25pt!important;line-height:1.08!important}.smid-qr-frame{max-width:9.3mm!important;padding:.3mm!important;border-radius:.5mm!important}.smid-scan-label{font-size:2.5pt!important}.smid-state{font-size:2.7pt!important;padding:.3mm .7mm!important}.smid-footer{gap:1.4mm!important;padding:.6mm 1.5mm 1.5mm!important}.smid-signature-mark{height:5mm!important}.smid-official-signature>span,.smid-date>span{font-size:2.8pt!important}.smid-date strong{font-size:3.8pt!important}.smid-footer-rule{height:.7mm!important}@page{size:90mm 60mm;margin:2mm}}
      `}</style>
    </>
  );
}
