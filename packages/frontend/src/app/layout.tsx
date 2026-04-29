import './globals.css';
import type { Metadata } from 'next';

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
        {children}
      </body>
    </html>
  );
}