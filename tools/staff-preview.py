#!/usr/bin/env python3
"""Нарезка листа мультяшных сотрудников (docs/staff-concepts/2-multyashnyj-OSNOVNOJ.jpg, сетка 4×3)
в app/img/staff-preview/1..12.webp — ТОЛЬКО для превью стилей (?preview_staff=1).
Фон (кремовый) и тень под ногами убираются заливкой от краёв клетки: толстые контуры персонажей её останавливают.
Запуск: python3 tools/staff-preview.py   (нужны Pillow и numpy)"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'docs', 'staff-concepts', '2-multyashnyj-OSNOVNOJ.jpg')
OUT = os.path.join(ROOT, 'app', 'img', 'staff-preview')
os.makedirs(OUT, exist_ok=True)

im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)
H, W, _ = im.shape
ROWS = [(0, 326), (326, 640), (640, H)]


def bg_like(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # кремовый фон и тёплая тень: светлые, тёплые (R ≥ G ≥ B), без насыщенных цветов
    return (r > 165) & (g > 135) & (b > 95) & (r - b < 105) & (r - b > 22) & (r >= g - 4) & (g >= b - 4)


def flood(cand):
    seed = np.zeros_like(cand)
    seed[0, :] = cand[0, :]; seed[-1, :] = cand[-1, :]; seed[:, 0] = cand[:, 0]; seed[:, -1] = cand[:, -1]
    while True:
        d = seed.copy()
        d[1:, :] |= seed[:-1, :]; d[:-1, :] |= seed[1:, :]; d[:, 1:] |= seed[:, :-1]; d[:, :-1] |= seed[:, 1:]
        d &= cand
        if (d == seed).all():
            return seed
        seed = d


def components(fg):
    """связные фигуры: [(размер, маска)] по убыванию размера"""
    h, w = fg.shape
    lab = np.zeros((h, w), np.int32); sizes = {}; cur = 0
    for y0, x0 in zip(*np.where(fg)):
        if lab[y0, x0]:
            continue
        cur += 1; st = [(y0, x0)]; lab[y0, x0] = cur; cnt = 0
        while st:
            y, x = st.pop(); cnt += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and fg[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = cur; st.append((yy, xx))
        sizes[cur] = cnt
    order = sorted(sizes, key=lambda k: -sizes[k])
    return lab, order


n = 0
for (y0, y1) in ROWS:
    a = im[y0:y1]
    fg = ~flood(bg_like(a))
    lab, order = components(fg)
    figs = sorted(order[:4], key=lambda k: np.where(lab == k)[1].mean())  # 4 самых больших — слева направо
    for k in figs:
        n += 1
        alpha = np.where(lab == k, 255, 0).astype(np.uint8)
        # мягкий край в 1 пиксель
        al = np.asarray(Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6)))
        img = Image.fromarray(np.dstack([a.astype(np.uint8), al]), 'RGBA')
        ys, xs = np.where(al > 24)
        img = img.crop((max(0, xs.min() - 3), max(0, ys.min() - 3), min(W, xs.max() + 4), min(a.shape[0], ys.max() + 4)))
        k2 = 300 / img.height
        img = img.resize((round(img.width * k2), 300), Image.LANCZOS)
        img.save(os.path.join(OUT, f'{n}.webp'), quality=88, method=6)
        print(n, img.size)
