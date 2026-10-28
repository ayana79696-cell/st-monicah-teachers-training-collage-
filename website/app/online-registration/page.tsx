import { redirect } from 'next/navigation';

// Use the live ERP application page so public applicants get the exact same
// form, Supabase submission workflow, signature/photo uploads, and tracking link.
export default function OnlineRegistrationPage() {
  redirect('https://st-monicah-teachers-training-collage-ih62tjqwj.vercel.app/apply');
}
