import '../styles/global.css';
import { Figtree, Outfit } from 'next/font/google';
import '@fortawesome/fontawesome-svg-core/styles.css'; // Import the CSS manually
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false; // Tell FontAwesome not to inject CSS automatically

// import '../lib/fontawesome';
import '@fortawesome/fontawesome-pro/css/all.min.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['700'],
});
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  title: 'Game Library',
  description: 'A game library to manage your games.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Game Library" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Game Library" />
        <link rel="apple-touch-icon" sizes="180x180" href="/game-library-icon-color4.webp" />
        <link rel="icon" type="image/svg" href="/game-library-icon-monochrome.svg" sizes="any" />
        <link rel="icon" type="image/webp" href="/game-library-icon-color4.webp" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta
          name="theme-color"
          content="#f9f9f9"
          media="(prefers-color-scheme: light)" />
        <meta
          name="theme-color"
          content="#121212"
          media="(prefers-color-scheme: dark)" />
      </head>
      <body className={`${outfit.variable} ${figtree.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}