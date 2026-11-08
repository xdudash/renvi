import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web shell. The splash is plain HTML/CSS, so something branded shows while the ~1 MB script downloads (the page was
// white for several seconds); it disappears by itself as soon as the app renders into #root.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#F7F5F2" />
        <meta name="description" content="RENVI — знакомства, планы и компании рядом." />
        <title>RENVI</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          body{background:#F7F5F2}
          #splash{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#F7F5F2;font:900 44px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-3px;color:#201E1D}
          #splash i{width:26px;height:26px;border-radius:50%;border:3px solid #e4e0d8;border-top-color:#DA302B;animation:sp .8s linear infinite}
          @keyframes sp{to{transform:rotate(360deg)}}
          #root:not(:empty)+#splash{display:none}
        ` }} />
      </head>
      <body>
        {children}
        <div id="splash" aria-hidden="true">renvi<i /></div>
      </body>
    </html>
  );
}
