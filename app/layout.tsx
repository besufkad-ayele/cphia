import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Inter, Roboto } from 'next/font/google';
import { BrandTransitionGate } from '@/components/brand/brand-transition-gate';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CPHIA Volunteer Registration',
  description: 'CPHIA Facility Volunteer Training — registration is closed for this intake.',
  icons: {
    icon: '/cphia-africa-logo.png',
    apple: '/cphia-2026-logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#186059',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('light font-sans', inter.variable, roboto.variable)}>
      <body>
        {children}
        <BrandTransitionGate />
        <Toaster />
      </body>
    </html>
  );
}
