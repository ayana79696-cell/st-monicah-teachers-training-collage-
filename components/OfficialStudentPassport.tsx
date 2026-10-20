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
  const match = value.match(/^(?:PASS\\s*)?(\\d+)$/i);
  return match ? String(Number(match[1])).padStart(3, '0') : value;
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
  applicantSignatureUrl,
  photoUrl,
}: {
  student: OfficialPassportStudent;
  passport: OfficialPassportRecord;
  programmeTitle?: string | null;
  applicantSignatureUrl?: string;
  photoUrl?: string | null;
}) {
  const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
  const verificationUrl = typeof window !== 'undefined' && passport.verification_token
    ? window.location.origin + '/verify-passport?token=' + encodeURIComponent(passport.verification_token)
    : '';
  const qrUrl = verificationUrl
    ? 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=3&data=' + encodeURIComponent(verificationUrl)
    : '';

  return (
    <>
      <article className="official-passport-card passport-card" aria-label="Official St. Monicah student passport">
        <div className="official-passport-watermark passport-card-watermark" aria-hidden="true"><img src={crest} alt="" /></div>
        <header className="official-passport-top passport-card-top">
          <img src={crest} alt="St. Monicah college crest" />
          <div><strong>ST. MONICAH</strong><span>TEACHERS TRAINING COLLEGE</span><small>OFFICIAL STUDENT PASSPORT</small></div>
        </header>
        <div className="official-passport-body passport-card-body">
          <div className="official-passport-photo passport-photo">
            {(photoUrl || passport.photo_url || student.passport_photo_url)
              ? <img src={photoUrl || passport.photo_url || student.passport_photo_url || ''} alt="Student portrait" />
              : <div className="official-passport-photo-placeholder">PHOTO</div>}
          </div>
          <div className="official-passport-details passport-details">
            <span className="official-passport-label passport-label">STUDENT NAME</span>
            <h3>{fullName || '—'}</h3>
            <span className="official-passport-label passport-label">ADMISSION NUMBER</span>
            <strong>{displayAdmission(student.admission_number)}</strong>
            <span className="official-passport-label passport-label">PROGRAMME</span>
            <strong>{programmeTitle || 'Not assigned'}</strong>
            <span className="official-passport-label passport-label">INTAKE</span>
            <strong>{[student.intake, student.intake_year].filter(Boolean).join(' ') || '—'}</strong>
            <span className="official-passport-label passport-label">PASSPORT NUMBER</span>
            <strong>{passport.passport_number || '—'}</strong>
          </div>
          <div className="official-passport-qr passport-qr">
            {qrUrl && <img src={qrUrl} alt="QR code for online passport verification" />}
            <small>SCAN TO VERIFY</small>
          </div>
        </div>
        <div className="official-passport-signatures">
          <div className="official-passport-signature official-applicant-signature">
            <span>APPLICANT SIGNATURE</span>
            {applicantSignatureUrl
              ? <img src={applicantSignatureUrl} alt="Applicant handwritten signature" />
              : <small>Signature on file not available</small>}
          </div>
          <div className="official-passport-signature official-authorized-signature">
            <span>AUTHORIZED SIGNATURE</span>
            {passport.authorized_signature_data_url
              ? <img src={passport.authorized_signature_data_url} alt="Authorized college officer handwritten signature" />
              : <small>Awaiting officer signature</small>}
          </div>
        </div>
        <footer className="official-passport-footer passport-card-footer">
          <span>ISSUED {displayDate(passport.issued_at)}</span>
          <span>{passport.expires_at ? 'EXPIRES ' + displayDate(passport.expires_at) : 'VALID UNTIL REVOKED OR EXPIRED'}</span>
        </footer>
      </article>
      <style jsx global>{`
        .official-passport-card{position:relative;isolation:isolate;display:grid;grid-template-rows:12mm minmax(0,1fr) 8mm 4mm;width:100%;max-width:620px;aspect-ratio:1.586;margin:0 auto;overflow:hidden;border:1px solid #c8a96a;border-radius:3mm;background:#fffdf8;color:#321d26;box-shadow:0 8px 24px rgba(49,17,34,.06);print-color-adjust:exact;-webkit-print-color-adjust:exact}
        .official-passport-watermark{position:absolute;inset:0;z-index:-1;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none}
        .official-passport-watermark img{width:72%;height:90%;object-fit:contain;opacity:.085;filter:grayscale(1)}
        .official-passport-top{display:flex;align-items:center;gap:2.5mm;padding:1.5mm 2.5mm;background:#4a142b;color:#fff}
        .official-passport-top>img{width:9mm;height:9mm;object-fit:contain;padding:.5mm;background:#fff;border-radius:50%}
        .official-passport-top>div{display:grid;gap:.5mm}
        .official-passport-top strong{font-size:7.5pt;line-height:1}
        .official-passport-top span,.official-passport-top small{font-size:4pt;letter-spacing:.04em}
        .official-passport-body{display:grid;grid-template-columns:18mm minmax(0,1fr) 12mm;align-items:center;gap:2mm;min-height:0;padding:1.5mm 2.5mm 0}
        .official-passport-photo{width:17mm;height:23mm;overflow:hidden;border:1px solid #d8c9ae;border-radius:1.5mm;background:#f4eddf;aspect-ratio:auto}
        .official-passport-photo>img{display:block;width:100%;height:100%;object-fit:cover}
        .official-passport-photo-placeholder{display:grid;place-items:center;width:100%;height:100%;font-size:5pt;color:#8b7b63}
        .official-passport-details{display:grid;align-content:center;gap:.55mm;min-width:0}
        .official-passport-label{font-size:4pt;line-height:1;color:#8e6a43;letter-spacing:.07em}
        .official-passport-details h3{margin:0;font-size:7.5pt;line-height:1.08;overflow-wrap:anywhere}
        .official-passport-details strong{font-size:6pt;line-height:1.05;font-weight:750;overflow-wrap:anywhere}
        .official-passport-qr{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.7mm;min-width:0}
        .official-passport-qr img{display:block;width:11mm;height:11mm;object-fit:contain;background:#fff}
        .official-passport-qr small{font-size:3pt;line-height:1;text-align:center;letter-spacing:.03em}
        .official-passport-signatures{display:grid;grid-template-columns:1fr 1fr;gap:2mm;align-items:end;padding:0 2.5mm 1mm}
        .official-passport-signature{display:flex;align-items:flex-end;gap:1.2mm;min-width:0;overflow:hidden;border-bottom:.2mm solid #bca67d;padding-bottom:.4mm}
        .official-passport-signature span{flex:0 0 auto;font-size:3.4pt;line-height:1;color:#80684f;letter-spacing:.03em}
        .official-passport-signature img{display:block;max-width:19mm;width:auto;max-height:5mm;object-fit:contain;object-position:left bottom}
        .official-passport-signature small{font-size:3pt;color:#93806a;line-height:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .official-passport-footer{display:flex;justify-content:space-between;align-items:center;gap:1mm;padding:.7mm 2.5mm;background:#f8f0df;font-size:3.3pt;line-height:1;color:#6e5944}
        @media(max-width:600px){.official-passport-card{border-radius:2mm}.official-passport-watermark img{width:78%;opacity:.075}.official-passport-details h3{font-size:clamp(7px,2.3vw,10px)}.official-passport-details strong{font-size:clamp(5px,1.7vw,7px)}}
        @media print{html,body{width:90mm!important;height:60mm!important;margin:0!important;padding:0!important;overflow:hidden!important}body *{visibility:hidden!important}.official-passport-card,.official-passport-card *{visibility:visible!important}.official-passport-card{position:absolute!important;left:0!important;top:0!important;width:85.6mm!important;height:54mm!important;max-width:none!important;aspect-ratio:auto!important;margin:0!important;border-radius:2mm!important;box-shadow:none!important;break-inside:avoid!important;grid-template-rows:12mm minmax(0,1fr) 8mm 4mm!important;overflow:hidden!important}.official-passport-watermark img{opacity:.08!important}.official-passport-top{padding:1mm 1.5mm!important;gap:1mm!important}.official-passport-top>img{width:7mm!important;height:7mm!important}.official-passport-top strong{font-size:6pt!important}.official-passport-top span,.official-passport-top small{font-size:3.2pt!important}.official-passport-body{grid-template-columns:14mm minmax(0,1fr) 9mm!important;gap:1mm!important;padding:.7mm 1.2mm 0!important}.official-passport-photo{width:13mm!important;height:17mm!important}.official-passport-details{gap:.35mm!important}.official-passport-label{font-size:3.2pt!important}.official-passport-details h3{font-size:5.4pt!important;line-height:1.02!important}.official-passport-details strong{font-size:4.2pt!important;line-height:1.02!important}.official-passport-qr img{width:8mm!important;height:8mm!important}.official-passport-qr small{font-size:2.2pt!important}.official-passport-signatures{padding:0 1.2mm .3mm!important;gap:1mm!important}.official-passport-signature{gap:.6mm!important}.official-passport-signature span{font-size:2.8pt!important}.official-passport-signature img{max-width:16mm!important;max-height:3.5mm!important}.official-passport-signature small{font-size:2.5pt!important}.official-passport-footer{padding:.4mm 1.2mm!important;font-size:2.8pt!important}@page{size:90mm 60mm;margin:2mm}}
      `}</style>
    </>
  );
}
