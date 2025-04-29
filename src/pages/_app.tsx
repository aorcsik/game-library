import '../styles/global.css';
import type { AppProps } from 'next/app';
import { Figtree, Outfit } from 'next/font/google';
import '@fortawesome/fontawesome-svg-core/styles.css'; // Import the CSS manually
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false; // Tell FontAwesome not to inject CSS automatically

import '../lib/fontawesome';

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

export default function MyApp({ Component, pageProps }: AppProps): React.JSX.Element {
  return (
    <main className={`${outfit.variable} ${figtree.variable} font-sans`}>
      <Component {...pageProps} />
    </main>
  );
}