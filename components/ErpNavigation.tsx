'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Group = 'dashboard'|'students'|'academics'|'exams'|'finance'|'hr'|'procurement'|'admissions'|'teaching'|'communications'|'reports'|'services';
type Props = { active?: 'overview'|'students'|'academics'|'attendance'|'finance'|'people'|'admissions'|'communication'|'passports'|'roles'|'reports'|'portal' };

const groups: {key:Group; label:string; href:string; matches:string[]; links:{label:string;href:string}[]}[] = [
 {key:'dashboard',label:'Dashboard',href:'/',matches:['/'],links:[{label:'Overview',href:'/'},{label:'Notifications',href:'/communications'},{label:'Quick actions',href:'/workspace?module=college_students'}]},
 {key:'students',label:'Students',href:'/workspace?module=college_students',matches:['/passports'],links:[{label:'Student Records',href:'/workspace?module=college_students'},{label:'Registration',href:'/workspace?module=college_students'},{label:'Passport Studio',href:'/passports'},{label:'Student Welfare',href:'/workspace?module=college_student_welfare_cases'},{label:'Student Portal',href:'/portal'},{label:'Parent / Sponsor Portal',href:'/parent-portal'}]},
 {key:'academics',label:'Academics',href:'/academics',matches:['/academics','/timetable','/attendance'],links:[{label:'Programmes',href:'/workspace?module=college_programmes'},{label:'Academic Periods',href:'/workspace?module=college_academic_periods'},{label:'Units',href:'/workspace?module=college_units'},{label:'Timetables · Offline',href:'/timetable'},{label:'QR Attendance',href:'/attendance'},{label:'Assessments',href:'/workspace?module=college_assessments'}]},
 {key:'exams',label:'Exams & Results',href:'/exam-entry',matches:['/exam-entry','/results','/graduation'],links:[{label:'Exam Setup & Entry',href:'/exam-entry'},{label:'Results & Grading',href:'/results'},{label:'Results Analysis',href:'/reports'},{label:'Report Cards',href:'/results'},{label:'Graduation & Certificates',href:'/graduation'}]},
 {key:'finance',label:'Finance',href:'/workspace?module=college_payments',matches:['/finance'],links:[{label:'Finance Dashboard',href:'/workspace?module=college_payments'},{label:'Fee Structures',href:'/workspace?module=college_fee_structures'},{label:'Fee Heads',href:'/workspace?module=college_fee_heads'},{label:'Fee Charges',href:'/workspace?module=college_fee_charges'},{label:'Payments',href:'/finance/receipts'},{label:'Receipts',href:'/finance/receipts'},{label:'Petty Cash',href:'/petty-cash'},{label:'Bank Accounts & M-Pesa',href:'/workspace?module=college_bank_accounts'},{label:'Balances & Reports',href:'/reports'}]},
 {key:'hr',label:'HR & Staff',href:'/workspace?module=college_staff',matches:['/staff-attendance'],links:[{label:'Staff Records',href:'/workspace?module=college_staff'},{label:'Staff Attendance',href:'/staff-attendance'},{label:'Staff Leave & Cover',href:'/leave-management'},{label:'Student Leave / Suspension',href:'/leave-management?tab=students'},{label:'Payroll Periods',href:'/workspace?module=college_payroll_periods'},{label:'Payroll Entries',href:'/workspace?module=college_payroll_entries'},{label:'Staff Development',href:'/workspace?module=college_staff_development'},{label:'Performance Appraisals',href:'/workspace?module=college_staff_appraisals'}]},
 {key:'procurement',label:'Procurement & Stock',href:'/procurement/requisitions',matches:['/inventory','/procurement'],links:[{label:'Requisitions',href:'/procurement/requisitions'},{label:'Approvals',href:'/procurement/approvals'},{label:'Purchase Orders',href:'/procurement/orders'},{label:'Suppliers',href:'/procurement/suppliers'},{label:'Deliveries',href:'/procurement/deliveries'},{label:'Invoices',href:'/procurement/invoices'},{label:'Stock Register',href:'/inventory'},{label:'Stock Movements',href:'/procurement/movements'},{label:'Low-stock Alerts',href:'/procurement/alerts'}]},
 {key:'admissions',label:'Admissions',href:'/admissions',matches:['/admissions','/apply'],links:[{label:'Applications',href:'/admissions'},{label:'Application Review',href:'/admissions'},{label:'Registration',href:'/workspace?module=college_students'},{label:'Admission Letters',href:'/admissions'},{label:'Public Application Form ↗',href:'/apply'}]},
 {key:'teaching',label:'Teaching Practice',href:'/workspace?module=college_practice_placements',matches:['/field-companion'],links:[{label:'Placements',href:'/workspace?module=college_practice_placements'},{label:'Partner Schools',href:'/workspace?module=college_practice_partners'},{label:'College Supervisors',href:'/workspace?module=college_staff'},{label:'School Visits',href:'/field-companion'},{label:'Offline Field Companion',href:'/field-companion'},{label:'Visit Observations',href:'/field-companion'},{label:'Final Assessment',href:'/workspace?module=college_practice_placements'}]},
 {key:'communications',label:'Communications',href:'/communications',matches:[],links:[{label:'SMS & Messages',href:'/communications'},{label:'Email',href:'/communications'},{label:'Announcements',href:'/communications'},{label:'Message History',href:'/communications'}]},
 {key:'reports',label:'Reports',href:'/reports',matches:[],links:[{label:'Academic Reports',href:'/reports'},{label:'Finance Reports',href:'/reports'},{label:'HR Reports',href:'/reports'},{label:'Procurement Reports',href:'/reports'},{label:'Management Reports',href:'/reports'},{label:'Audit Trail',href:'/reports'}]},
 {key:'services',label:'Services & Admin',href:'/services',matches:['/roles','/learning','/services'],links:[{label:'Library',href:'/workspace?module=college_library_items'},{label:'Accommodation',href:'/workspace?module=college_hostel_rooms'},{label:'Student Welfare',href:'/workspace?module=college_student_welfare_cases'},{label:'Alumni & Employment',href:'/workspace?module=college_alumni_records'},{label:'Roles & Permissions',href:'/roles'},{label:'System Settings',href:'/services'},{label:'Learning Center',href:'/learning'}]},
];

function groupForPath(path:string, module:string, active?:Props['active']):Group {
 if (path==='/') return 'dashboard';
 if (path.startsWith('/passports') || module==='college_students' || module==='college_student_welfare_cases' || path==='/portal' || path==='/parent-portal') return 'students';
 if (path==='/staff-attendance' || path==='/leave-management') return 'hr';
 if (path.startsWith('/academics') || path==='/timetable' || path==='/attendance') return active==='people' ? 'hr' : 'academics';
 if (path.startsWith('/exam-entry') || path==='/results' || path==='/graduation') return 'exams';
 if (path.startsWith('/finance') || path==='/petty-cash' || ['college_payments','college_bank_accounts','college_fee_heads','college_fee_structures','college_fee_charges'].includes(module)) return 'finance';
 if (['college_staff','college_staff_leave_requests','college_payroll_periods','college_payroll_entries','college_staff_development','college_staff_appraisals'].includes(module)) return 'hr';
 if (path==='/inventory' || path.startsWith('/procurement') || module==='college_procurement_requests') return 'procurement';
 if (path.startsWith('/admissions') || path==='/apply') return 'admissions';
 if (path==='/field-companion' || module==='college_practice_placements' || module==='college_practice_partners') return 'teaching';
 if (path==='/communications') return 'communications';
 if (path==='/reports') return 'reports';
 if (path==='/roles' || path==='/services' || path==='/learning' || ['college_library_items','college_hostel_rooms','college_hostel_allocations','college_alumni_records','college_profiles'].includes(module)) return 'services';
 if (active==='people') return 'hr';
 if (active==='finance') return 'finance';
 if (active==='admissions') return 'admissions';
 if (active==='communication') return 'communications';
 if (active==='reports') return 'reports';
 return 'dashboard';
}

export default function ErpNavigation({active='overview'}:Props) {
 const pathname=usePathname();
 const [module,setModule]=useState('');
 useEffect(()=>{setModule(new URLSearchParams(window.location.search).get('module')||'');},[pathname]);
 const current=groupForPath(pathname,module,active);
 const group=groups.find(item=>item.key===current) ?? groups[0];
 return <div className="erp-navigation">
  <nav className="workspace-topnav" aria-label="Main navigation">
   {groups.map(item=><a key={item.key} className={'topnav-link '+(item.key===current?'active':'')} href={item.href} aria-current={item.key===current?'page':undefined}>{item.label}</a>)}
  </nav>
  <nav className="workspace-subnav" aria-label={group.label+' subpages'}>
   <span className="subnav-heading">{group.label}</span>
   {group.links.map((link,index)=><a key={link.label+'-'+index} className={'subnav-link '+(index===0?'subnav-primary':'')} href={link.href}>{link.label}</a>)}
  </nav>
 </div>;
}
