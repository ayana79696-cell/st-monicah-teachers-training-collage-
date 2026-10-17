import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "St. Monica's Teachers Training College ERP",
  description: 'Academic, student, teaching practice and college administration portal.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
