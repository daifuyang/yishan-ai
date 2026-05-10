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
  viewportFit: 'cover',
  // Let virtual keyboard resize layout viewport on mobile browsers (e.g. Edge),
  // so fixed/sticky input areas are pushed above the keyboard instead of covered.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
