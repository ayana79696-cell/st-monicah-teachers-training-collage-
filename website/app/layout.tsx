import type { Metadata } from "next";
import "./globals.css";
import "./campus-imagery.css";

export const metadata: Metadata = {
  title: "St Monicah Teachers Training College | Learn, Lead, Teach",
  description: "Discover teacher education programmes, admissions information and online application at St Monicah Teachers Training College.",
  applicationName: "St Monicah Teachers Training College",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
