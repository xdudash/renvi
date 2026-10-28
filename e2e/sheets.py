import os
from PIL import Image, ImageDraw
refs = sorted(os.listdir('out/ref'))
os.makedirs('out/sheets', exist_ok=True)
S = 0.5
w, h = int(393 * S), int(852 * S)
per_row, rows = 4, 2
for k in range(0, len(refs), per_row * rows):
    chunk = refs[k:k + per_row * rows]
    sheet = Image.new('RGB', (per_row * (2 * w + 30), rows * (h + 24)), 'white')
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        x = (i % per_row) * (2 * w + 30); y = (i // per_row) * (h + 24)
        a = Image.open('out/app/' + f).resize((w, h)); r = Image.open('out/ref/' + f).resize((w, h))
        sheet.paste(a, (x, y + 20)); sheet.paste(r, (x + w + 4, y + 20))
        d.text((x + 2, y + 4), f.replace('.png', '') + '   app | prototype', fill='black')
    sheet.save(f'out/sheets/{k // 8 + 1:02d}.png')
print(len(os.listdir('out/sheets')))
