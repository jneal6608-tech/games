#!/usr/bin/env python3
"""Build the 1024x500 Google Play feature graphic from a gameplay screenshot, the icon and the title.
Usage: python3 tools/make_feature_graphic.py <display font .ttf> <body font .ttf>
The fonts are the game's own (assets/fonts, SIL OFL); convert the .woff2 files to .ttf with fontTools first."""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

root = pathlib.Path(__file__).resolve().parent.parent
shot = Image.open(root / "store/screenshots/03_abyss.png").convert("RGB")
W, H = 1024, 500
# the action around the fish goes on the right; its edge colour fills the rest, darker toward the title
play = shot.crop((0, 400, 1080, 1480)).resize((560, 560), Image.LANCZOS).crop((0, 30, 560, 530))
bg = Image.new("RGB", (W, H), shot.getpixel((30, 700)))
bg.paste(play, (W - 560, 0))
mask = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(mask)
for x in range(W):
    # fully the flat colour left of the picture, fading out over its first 200 px
    d.line([(x, 0), (x, H)], fill=int(255 * min(1.0, max(0.0, (W - 560 + 200 - x) / 200.0))))
bg = Image.composite(Image.new("RGB", (W, H), (10, 6, 28)), bg, mask)
title_font = ImageFont.truetype(sys.argv[1], 84)
sub_font = ImageFont.truetype(sys.argv[2], 34)
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).text((54, 150), "LURELIGHT", font=title_font, fill=(255, 190, 70, 255))
glow = glow.filter(ImageFilter.GaussianBlur(14))
bg = Image.alpha_composite(bg.convert("RGBA"), glow)
d = ImageDraw.Draw(bg)
d.text((54, 150), "LURELIGHT", font=title_font, fill=(255, 216, 107))
d.text((58, 268), "Swing the light. Survive the deep.", font=sub_font, fill=(214, 232, 255))
bg.convert("RGB").save(root / "store/feature_graphic.png")
print("wrote store/feature_graphic.png", bg.size)
