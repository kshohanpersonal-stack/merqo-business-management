#!/usr/bin/env python3
"""Derive the Windows icon set and splash assets from the generated product logo."""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets/images/merqo-logo.png'
ICONS = ROOT / 'assets/icons'
IMAGES = ROOT / 'assets/images'
ICONS.mkdir(exist_ok=True)
IMAGES.mkdir(exist_ok=True)

logo = Image.open(SRC).convert('RGBA')
# Make the pure-white background transparent while keeping the white receipt shape.
px = logo.load()
w, h = logo.size
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        border = x < 8 or y < 8 or x > w - 9 or y > h - 9
        if r > 246 and g > 246 and b > 246 and border:
            px[x, y] = (r, g, b, 0)
# Crop to content with padding, then square-pad for clean small-size rendering.
bbox = logo.getbbox()
logo = logo.crop(bbox)
side = max(logo.size) + int(max(logo.size) * 0.12)
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.alpha_composite(logo, ((side - logo.width) // 2, (side - logo.height) // 2))

sizes = [16, 24, 32, 48, 64, 128, 256]
for s in sizes:
    icon = canvas.resize((s, s), Image.Resampling.LANCZOS)
    icon.save(ICONS / f'merqo-{s}.png')
canvas.resize((256, 256), Image.Resampling.LANCZOS).save(
    ICONS / 'merqo.ico', sizes=[(s, s) for s in sizes]
)
canvas.resize((512, 512), Image.Resampling.LANCZOS).save(ICONS / 'merqo.png')

# Splash / loading asset: light canvas, centered logo, product wordmark, no company logo.
splash = Image.new('RGB', (900, 520), '#F5F7FA')
d = ImageDraw.Draw(splash)
d.rounded_rectangle((8, 8, 892, 512), radius=28, outline='#E2E8F0', width=2)
mark = canvas.resize((190, 190), Image.Resampling.LANCZOS)
splash.paste(mark, (450 - 95, 92), mark)
def font(path: str, size: int):
    try: return ImageFont.truetype(path, size)
    except OSError: return ImageFont.load_default()
latin = font('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 54)
sub = font('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
small = font('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
bbox = d.textbbox((0, 0), 'MERQO', font=latin)
d.text((450 - (bbox[2] - bbox[0]) / 2, 300), 'MERQO', font=latin, fill='#12233B')
text = 'Offline Business Management & POS'
bbox = d.textbbox((0, 0), text, font=sub)
d.text((450 - (bbox[2] - bbox[0]) / 2, 370), text, font=sub, fill='#64748B')
text2 = 'Starting your workspace…'
bbox = d.textbbox((0, 0), text2, font=small)
d.text((450 - (bbox[2] - bbox[0]) / 2, 410), text2, font=small, fill='#94A3B8')
d.rounded_rectangle((330, 452, 570, 458), radius=3, fill='#E2E8F0')
d.rounded_rectangle((330, 452, 470, 458), radius=3, fill='#0F766E')
splash.save(IMAGES / 'merqo-splash.png')
print('Generated icon set:', ', '.join(p.name for p in sorted(ICONS.iterdir())))
