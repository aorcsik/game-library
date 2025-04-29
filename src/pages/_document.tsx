import { Html, Head, Main, NextScript } from 'next/document';

export default function Document(): React.JSX.Element {
  return (
    <Html lang="en">
      <Head>
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Game Library" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Game Library" />
        <link rel="icon" type="image/webp" href="game-library-icon-color.webp" sizes="192x192" />
        <link rel="apple-touch-icon" sizes="180x180" href="game-library-icon-color.webp" />
        <link rel="icon" type="image/svg" href="game-library-icon-monochrome.svg" sizes="32x32" />
        <link rel="icon" type="image/svg" href="game-library-icon-monochrome.svg" sizes="16x16" />
        <link rel="icon" type="image/svg" href="game-library-icon-monochrome.svg" />
        <link rel="icon" type="image/svg" href="game-library-icon-monochrome.svg" sizes="any" />
        <link rel="icon" type="image/webp" href="game-library-icon-color.webp" sizes="192x192" />
        <link rel="icon" type="image/webp" href="game-library-icon-color.webp" sizes="512x512" />
        <link rel="manifest" href="manifest.json" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}