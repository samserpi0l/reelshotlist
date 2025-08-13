// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="de">
      <Head>
        {/* PWA Basics */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#111827" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ReelShotlist" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/* Fallback Favicons */}
        <link rel="icon" href="/icons/icon-192.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
