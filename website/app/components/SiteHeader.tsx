"use client";
import { useState } from "react";
const crest = "https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png";
export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <>
    <div className="topline"><div className="container topline-inner"><span>ST MONICAH TEACHERS TRAINING COLLEGE</span><span>Shaping the teachers who shape tomorrow</span></div></div>
    <header className="header"><div className="container nav-wrap">
      <a className="brand" href="/"><img src={crest} alt="St Monicah College crest"/><span><strong>ST MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a>
      <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? "✕" : "☰"}</button>
      <nav className={open ? "nav-links open" : "nav-links"} aria-label="Main navigation">
        <a href="/" onClick={() => setOpen(false)}>Home</a><a href="/about" onClick={() => setOpen(false)}>About Us</a><a href="/programmes" onClick={() => setOpen(false)}>Programmes</a><a href="/admissions" onClick={() => setOpen(false)}>Admissions</a><a href="/campus-life" onClick={() => setOpen(false)}>Campus Life</a><a href="/contact" onClick={() => setOpen(false)}>Contact</a><a className="nav-apply" href="/online-registration" onClick={() => setOpen(false)}>Online registration <span>↗</span></a>
      </nav>
    </div></header>
  </>;
}
