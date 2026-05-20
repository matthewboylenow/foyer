import type { Metadata } from 'next';
import { Libre_Baskerville, Libre_Franklin } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const baskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif',
  display: 'swap',
});

const franklin = Libre_Franklin({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Foyer — Saint Helen Parish Signage',
  description: 'Digital signage management for Saint Helen Parish',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${baskerville.variable} ${franklin.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
