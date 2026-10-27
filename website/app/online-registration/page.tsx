"use client";

import { useState } from "react";

const crest = "https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png";

export default function OnlineRegistrationPage() {
  const [notice, setNotice] = useState(false);
  const [form, setForm] = useState({
    fullName: "", dob: "", gender: "", nationalId: "", phone: "", email: "",
    kcseIndex: "", kcseYear: "", kcseGrade: "", course: "", mode: "", intake: "",
    county: "", address: ""
  });
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Do not simulate a successful application until the secure Supabase/ERP workflow is connected.
    setNotice(true);
  }

  return (
    <main className="registration-page">
      <header className="registration-header"><div className="container registration-header-inner"><a className="brand" href="/"><img src={crest} alt="St Monicah College crest"/><span><strong>ST MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a><a className="back-home" href="/">← Back to official website</a></div></header>
      <section className="registration-banner"><div className="container"><p className="overline light-overline">ADMISSIONS / ONLINE PORTAL</p><h1>Online student<br/><em>registration.</em></h1><p>Welcome to the St Monicah Teachers Training College online registration portal. Complete your details carefully to begin your application.</p><div className="registration-progress"><span>01</span><div><strong>Applicant details</strong><small>Complete all required fields</small></div><i/><span>02</span><div><strong>Admissions review</strong><small>College review follows submission</small></div></div></div></section>
      <section className="registration-content"><div className="container registration-layout"><aside className="registration-aside"><div className="aside-card"><img src={crest} alt="College crest"/><h2>Start your journey.</h2><p>Use this portal to provide the information the admissions team needs to assess your application.</p><ul><li>Use your official names as shown on your documents.</li><li>Check your phone number and email address carefully.</li><li>Have your KCSE index number and results available.</li><li>Confirm your preferred programme and study mode.</li></ul></div><div className="help-card"><strong>Need help?</strong><p>Contact the college admissions office for assistance with programme requirements or intake dates.</p><a href="/#contact">College contact information ↗</a></div></aside>
      <div className="registration-form-card"><div className="registration-form-heading"><span className="form-label">NEW APPLICANT</span><h2>Applicant registration form</h2><p>Fields marked with * are required.</p></div>{notice ? <div className="form-notice"><span className="notice-icon">i</span><h3>Registration portal preview</h3><p>The registration form is ready for review, but secure application submission has not yet been connected to the college's Supabase database and ERP admissions workflow. Your details have not been saved. Please do not rely on this preview to submit an official application.</p><button className="btn btn-gold" onClick={() => setNotice(false)}>Return to registration form</button></div> : <form onSubmit={handleSubmit}>
        <div className="form-section-title"><span>01</span><div><h3>Personal information</h3><p>Enter your identity and contact details.</p></div></div>
        <div className="field"><label htmlFor="fullName">Full name as shown on documents *</label><input id="fullName" required value={form.fullName} onChange={e=>update("fullName",e.target.value)} placeholder="Enter your full name"/></div>
        <div className="form-row"><div className="field"><label htmlFor="dob">Date of birth</label><input id="dob" type="date" value={form.dob} onChange={e=>update("dob",e.target.value)}/></div><div className="field"><label htmlFor="gender">Gender</label><select id="gender" value={form.gender} onChange={e=>update("gender",e.target.value)}><option value="">Select option</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></div></div>
        <div className="form-row"><div className="field"><label htmlFor="nationalId">National ID / passport number</label><input id="nationalId" value={form.nationalId} onChange={e=>update("nationalId",e.target.value)} placeholder="Enter ID number"/></div><div className="field"><label htmlFor="phone">Phone number *</label><input id="phone" type="tel" required value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="+254 ..."/></div></div>
        <div className="field"><label htmlFor="email">Email address *</label><input id="email" type="email" required value={form.email} onChange={e=>update("email",e.target.value)} placeholder="you@example.com"/></div>
        <div className="form-row"><div className="field"><label htmlFor="county">County of residence</label><input id="county" value={form.county} onChange={e=>update("county",e.target.value)} placeholder="County"/></div><div className="field"><label htmlFor="address">Town / area</label><input id="address" value={form.address} onChange={e=>update("address",e.target.value)} placeholder="Town or area"/></div></div>
        <div className="form-section-title"><span>02</span><div><h3>Academic information</h3><p>Provide your KCSE examination details if applicable.</p></div></div>
        <div className="form-row"><div className="field"><label htmlFor="kcseIndex">KCSE index number</label><input id="kcseIndex" value={form.kcseIndex} onChange={e=>update("kcseIndex",e.target.value)} placeholder="Index number"/></div><div className="field"><label htmlFor="kcseYear">KCSE examination year</label><input id="kcseYear" inputMode="numeric" value={form.kcseYear} onChange={e=>update("kcseYear",e.target.value)} placeholder="e.g. 2024"/></div></div>
        <div className="field"><label htmlFor="kcseGrade">KCSE mean grade</label><select id="kcseGrade" value={form.kcseGrade} onChange={e=>update("kcseGrade",e.target.value)}><option value="">Select grade</option>{["A","A-","B+","B","B-","C+","C","C-","D+","D","D-","E","Other / awaiting results"].map(g=><option key={g}>{g}</option>)}</select></div>
        <div className="form-section-title"><span>03</span><div><h3>Programme selection</h3><p>Choose the course, study mode and intended intake.</p></div></div>
        <div className="field"><label htmlFor="course">Programme applied for *</label><select id="course" required value={form.course} onChange={e=>update("course",e.target.value)}><option value="">Select programme</option><option>Diploma in Secondary Teacher Education (DSTE)</option><option>Diploma in Teacher Education (DTEP / P&amp;P)</option><option>Other / need admissions guidance</option></select></div>
        <div className="form-row"><div className="field"><label htmlFor="mode">Preferred study mode *</label><select id="mode" required value={form.mode} onChange={e=>update("mode",e.target.value)}><option value="">Select mode</option><option>Full time</option><option>School based</option><option>Part time</option></select></div><div className="field"><label htmlFor="intake">Preferred intake month *</label><select id="intake" required value={form.intake} onChange={e=>update("intake",e.target.value)}><option value="">Select month</option>{["January","February","March","April","May","June","July","August","September","October","November","December"].map(m=><option key={m}>{m}</option>)}</select></div></div>
        <div className="registration-consent"><p>Before this portal is opened for official applications, the college will provide its privacy notice and secure document-upload process. This preview does not store or submit your details.</p></div>
        <button type="submit" className="btn btn-gold full-btn">Review registration details <span>↗</span></button>
      </form>}</div></div></section>
      <footer className="registration-footer"><div className="container"><span>© {new Date().getFullYear()} St Monicah Teachers Training College</span><a href="/">Return to college website ↑</a></div></footer>
    </main>
  );
}
