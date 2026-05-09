import './globals.scss';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { VConsoleProvider } from '@/components/vconsole-provider';

export const metadata: Metadata = {
  title: 'Yishan AI',
  description: 'AI Chat Application',
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