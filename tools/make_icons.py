"""Рисует иконки приложения (лапа на зелёном фоне). Запуск: python3 tools/make_icons.py icons"""
import os
import sys

from PIL import Image, ImageDraw

BG = (47, 111, 94, 255)
FG = (246, 244, 239, 255)


def paw(size):
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)
    s = size
    d.ellipse([s * 0.30, s * 0.47, s * 0.70, s * 0.79], fill=FG)
    for x, y in [(0.25, 0.37), (0.41, 0.25), (0.59, 0.25), (0.75, 0.37)]:
        r = s * 0.085
        d.ellipse([s * x - r, s * y - r, s * x + r, s * y + r], fill=FG)
    return img


out = sys.argv[1] if len(sys.argv) > 1 else "icons"
os.makedirs(out, exist_ok=True)
for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    paw(size).save(os.path.join(out, name))
    print("saved", name)
