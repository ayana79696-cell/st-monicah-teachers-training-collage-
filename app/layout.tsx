import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "St. Monica's Teachers Training College ERP",
  description: 'Academic, student, teaching practice and college administration portal.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = { themeColor: '#54162b' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
