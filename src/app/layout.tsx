import type { Metadata } from 'next';
import './globals.css';
import localFont from 'next/font/local';
import { cn } from '@/lib/utils';
import { SiteBackground } from '@/components/shared/site-background';
import { SwingOverlay } from '@/components/swing/swing-overlay';

const display = localFont({
  src: [
    { path: '../../public/fonts/big-shoulders-700.ttf', weight: '700' },
    { path: '../../public/fonts/big-shoulders-900.ttf', weight: '900' },
  ],
  variable: '--font-display',
});

const sans = localFont({
  src: [
    { path: '../../public/fonts/archivo-400.ttf', weight: '400' },
    { path: '../../public/fonts/archivo-500.ttf', weight: '500' },
    { path: '../../public/fonts/archivo-600.ttf', weight: '600' },
  ],
  variable: '--font-sans',
});

const mono = localFont({
  src: [
    { path: '../../public/fonts/jetbrains-mono-400.ttf', weight: '400' },
    { path: '../../public/fonts/jetbrains-mono-600.ttf', weight: '600' },
  ],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'SPIDEY tracXer',
  description: 'Search the SpiderXman',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn('dark font-sans', display.variable, sans.variable, mono.variable)}
    >
      {/* The shadow keeps text readable over the bright background. */}
      <body className="antialiased [text-shadow:0_0_3px_#000,0_0_8px_#000,0_1px_2px_#000]">
        <SiteBackground />
        {children}
        <SwingOverlay />
      </body>
    </html>
  );
}
