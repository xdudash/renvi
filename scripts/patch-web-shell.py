"""Post-export patch of dist/index.html: branded splash while the bundle downloads, mobile meta tags, optional custom domain.
Expo's 'single' web output ignores +html.tsx, so the shell is patched after `expo export`."""
import os, re, sys
p = os.path.join(sys.argv[1] if len(sys.argv) > 1 else 'dist', 'index.html')
h = open(p, encoding='utf-8').read()
css = ("<meta name=\"theme-color\" content=\"#F7F5F2\"><style>body{background:#F7F5F2}"
       "#splash{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;"
       "background:#F7F5F2;font:900 44px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-3px;color:#201E1D}"
       "#splash i{width:26px;height:26px;border-radius:50%;border:3px solid #e4e0d8;border-top-color:#DA302B;animation:sp .8s linear infinite}"
       "@keyframes sp{to{transform:rotate(360deg)}}#root:not(:empty)+#splash{display:none}</style>")
assert '</head>' in h and '</body>' in h and 'id="root"' in h, 'unexpected index.html shape'
h = re.sub(r'(<meta name="viewport" content=")[^"]*(")', r'\1width=device-width, initial-scale=1, viewport-fit=cover\2', h)
h = h.replace('</head>', css + '</head>', 1)
h = h.replace('</body>', '<div id="splash" aria-hidden="true">renvi<i></i></div></body>', 1)
open(p, 'w', encoding='utf-8').write(h)
