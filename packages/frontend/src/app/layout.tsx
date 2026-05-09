import './globals.scss';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { VConsoleProvider } from '@/components/vconsole-provider';

export const metadata: Metadata = {
  title: 'Yishan AI',
  description: 'AI Chat Application',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="antialiased">
        <VConsoleProvider />
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}