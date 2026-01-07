import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ToastContainer } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: 'HealthHub',
  description: 'A comprehensive health management application',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/logo192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HealthHub',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
