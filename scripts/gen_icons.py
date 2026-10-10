#!/usr/bin/env python3
"""Generate PWA icons with stdlib only (no Pillow): dark rounded square + cyan orb."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


def png_chunk(kind: bytes, data: bytes) -> bytes:
    chunk = kind + data
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk))


def write_png(path: Path, size: int) -> None:
    raw = bytearray()
    cx = cy = size / 2.0
    for y in range(size):
        raw.append(0)
        for x in range(size):
            # rounded-square backdrop
            m = size * 0.06
            in_rect = m <= x < size - m and m <= y < size - m
            dx, dy = (x - cx) / (size * 0.32), (y - cy) / (size * 0.32)
            r = math.hypot(dx, dy)
            if r <= 1.0:
                glow = max(0.0, 1.0 - r)
                red = int(20 + glow * 120)
                green = int(40 + glow * 200)
                blue = int(70 + glow * 185)
                alpha = 255
            elif in_rect:
                red, green, blue, alpha = 10, 12, 18, 255
            else:
                red, green, blue, alpha = 0, 0, 0, 0
            raw += bytes((red, green, blue, alpha))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + png_chunk(b"IEND", b""))
    print(f"wrote {path} ({size}x{size})")


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "web" / "public" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("maskable-512.png", 512), ("apple-180.png", 180)):
        write_png(out / name, size)


if __name__ == "__main__":
    main()
