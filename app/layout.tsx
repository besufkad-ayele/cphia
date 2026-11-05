import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CPHIA Volunteer Registration',
  description: 'Facility Volunteer Training registration system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
