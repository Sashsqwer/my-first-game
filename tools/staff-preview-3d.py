#!/usr/bin/env python3
"""Нарезка листа 3D-фигурок (docs/staff-concepts/1-figurki-3d.jpg, сетка 4×3)
в app/img/staff-preview-3d/1..12.webp — ТОЛЬКО для превью «Коллекции» (?theme=collection&preview_staff=1).
Фон листа — серая студийная «циклорама» с плавным градиентом: подбираем его гладкой поверхностью (полином 2-й степени
по клетке), фон = пиксели, близкие к этой поверхности и бесцветные; заливка от краёв клетки. Фигурка остаётся вместе
со своей подставкой. Запуск: python3 tools/staff-preview-3d.py   (нужны Pillow и numpy)"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'docs', 'staff-concepts', '1-figurki-3d.jpg')
OUT = os.path.join(ROOT, 'app', 'img', 'staff-preview-3d')
os.makedirs(OUT, exist_ok=True)

im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
ROWS = [(0, 352), (352, 678), (678, H)]
COLS = [(0, 256), (256, 512), (512, 768), (768, W)]


def fit_bg(a, mask):
    h, w = mask.shape
    yy, xx = np.mgrid[0:h, 0:w]
    y, x = yy / h, xx / w
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    g = a.mean(2).reshape(-1)
    m = mask.reshape(-1)
    coef, *_ = np.linalg.lstsq(A[m], g[m], rcond=None)
    return (A @ coef).reshape(h, w)


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


def largest(fg):
    from collections import deque
    h, w = fg.shape
    lab = np.zeros((h, w), np.int32); best = (0, 0); cur = 0
    for y0, x0 in zip(*np.where(fg)):
        if lab[y0, x0]:
            continue
        cur += 1; q = deque([(y0, x0)]); lab[y0, x0] = cur; cnt = 0
        while q:
            y, x = q.popleft(); cnt += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and fg[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = cur; q.append((yy, xx))
        if cnt > best[0]:
            best = (cnt, cur)
    return lab == best[1]


def pedestal_clip(a, fg, bg, grey):
    """обрезаем мягкую тень вокруг подставки: ниже верха подставки оставляем только «цилиндр» подставки
    (по светлому тёплому диску сверху подставки — центр и ширина)"""
    h, w = fg.shape
    top = int(h * .7)
    r, b = a[..., 0], a[..., 2]
    disc = (grey - bg > 10) & (r - b > 14) & fg
    disc[:top] = False
    ys, xs = np.where(disc)
    if len(xs) < 50:
        return fg
    x_lo, x_hi = np.percentile(xs, 2), np.percentile(xs, 98)
    cx, rx = (x_lo + x_hi) / 2, (x_hi - x_lo) / 2 * 1.1
    y_lo, y_hi = np.percentile(ys, 1), np.percentile(ys, 99)
    ry = max(6, (y_hi - y_lo) / 2 * 1.15)
    cy = (y_lo + y_hi) / 2
    # низ подставки: самый нижний пиксель фигуры в центральной полосе
    col = fg[:, int(cx - rx * .3):int(cx + rx * .3)]
    bottom = np.where(col.any(1))[0].max()
    yy, xx = np.mgrid[0:h, 0:w]
    dx = (xx - cx) / rx
    sq = np.sqrt(np.clip(1 - dx * dx, 0, 1))
    inside = (np.abs(dx) <= 1) & (yy <= bottom - ry * (1 - sq) + 1)
    above = yy < y_lo - max(ry * 2.6, h * .17)  # заметно выше подставки — всё (руки, предметы)
    above |= (yy < y_lo - ry * .6) & (np.abs(dx) <= 1)  # над подставкой — только в её ширину (ноги), тень по бокам — прочь
    keep = above | inside
    return fg & keep


n = 0
for (y0, y1) in ROWS:
    for (x0, x1) in COLS:
        n += 1
        a = im[y0:y1, x0:x1]
        sat = a.max(2) - a.min(2)
        grey = a.mean(2)
        mask = (sat < 14) & (grey > 170)
        bg = fit_bg(a, mask)
        for _ in range(2):  # уточняем по пикселям, близким к поверхности
            mask = mask & (np.abs(grey - bg) < 10)
            bg = fit_bg(a, mask)
        cand = (np.abs(grey - bg) < 11) & (sat < 16)
        # мягкая тень от подставки: чуть темнее фона, но бесцветная и ниже подставки — тоже фон
        cand |= (grey - bg < 0) & (grey - bg > -38) & (sat < 12) & (np.arange(a.shape[0])[:, None] > a.shape[0] * .86)
        fg = largest(~flood(cand))
        fg = pedestal_clip(a, fg, bg, grey)
        # второй проход: «дотираем» серые остатки тени у края (бесцветные, близкие к фону), только с краёв фигуры
        soft = (np.abs(grey - bg) < 22) & (sat < 12)
        soft[:int(a.shape[0] * .72)] = False  # только у подставки: белый колпак, ножницы и седина не трогаем
        fg = largest(~flood(soft | ~fg))
        alpha = np.where(fg, 255, 0).astype(np.uint8)
        al = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
        img = Image.fromarray(np.dstack([a.astype(np.uint8), np.asarray(al)]), 'RGBA')
        ys, xs = np.where(np.asarray(al) > 24)
        img = img.crop((max(0, xs.min() - 2), max(0, ys.min() - 2), min(a.shape[1], xs.max() + 3), min(a.shape[0], ys.max() + 3)))
        k = 300 / img.height
        img = img.resize((round(img.width * k), 300), Image.LANCZOS)
        img.save(os.path.join(OUT, f'{n}.webp'), quality=88, method=6)
        print(n, img.size)
