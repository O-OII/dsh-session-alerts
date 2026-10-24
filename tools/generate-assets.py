"""Generate MIT-licensed, original geometric digits; stdlib only, no font files.

This script never opens a desktop window or calls Windows APIs. ICO images have
16/24/32/48/64 px 32-bit DIB entries and are deterministic across platforms.
"""
from pathlib import Path
import struct

# Hand-authored 3-by-5 geometry, not glyphs rasterized from a third-party font.
DIGITS = {
    '0': ('111', '101', '101', '101', '111'),
    '1': ('010', '110', '010', '010', '111'),
    '2': ('111', '001', '111', '100', '111'),
    '3': ('111', '001', '111', '001', '111'),
    '4': ('101', '101', '111', '001', '001'),
    '5': ('111', '100', '111', '001', '111'),
    '6': ('111', '100', '111', '101', '111'),
    '7': ('111', '001', '010', '010', '010'),
    '8': ('111', '101', '111', '101', '111'),
    '9': ('111', '101', '111', '001', '111'),
    '+': ('000', '010', '111', '010', '000'),
}
SIZES = (16, 24, 32, 48, 64)


def bitmap(label, size):
    width = len(label) * 4 - 1
    unit = min(size * 0.67 / width, size * 0.66 / 5)
    left, top = (size - width * unit) / 2, (size - 5 * unit) / 2
    pixels = bytearray()
    for y in reversed(range(size)):
        for x in range(size):
            color = [0, 0, 0, 0]
            for sy in (0.125, 0.375, 0.625, 0.875):
                for sx in (0.125, 0.375, 0.625, 0.875):
                    px, py = x + sx, y + sy
                    radius2 = (px - size / 2) ** 2 + (py - size / 2) ** 2
                    alpha = 255 if radius2 <= (size * 0.48) ** 2 else 0
                    light = 255 if radius2 > (size * 0.44) ** 2 else 36
                    gx, gy = int((px - left) // unit), int((py - top) // unit)
                    if px >= left and py >= top and 0 <= gx < width and 0 <= gy < 5:
                        digit, column = divmod(gx, 4)
                        if column < 3 and DIGITS[label[digit]][gy][column] == '1':
                            light = 255
                    for i in range(3):
                        color[i] += light if alpha else 0
                    color[3] += alpha
            pixels.extend(round(value / 16) for value in color)  # BGRA (monochrome)
    mask_stride = ((size + 31) // 32) * 4
    mask = bytearray(mask_stride * size)
    for row in range(size):
        for x in range(size):
            if pixels[(row * size + x) * 4 + 3] == 0:
                mask[row * mask_stride + x // 8] |= 1 << (7 - x % 8)
    header = struct.pack('<IiiHHIIiiII', 40, size, size * 2, 1, 32, 0, len(pixels), 0, 0, 0, 0)
    return header + pixels + mask


def icon(label):
    entries = [bitmap(label, size) for size in SIZES]
    offset = 6 + len(entries) * 16
    directory = bytearray(struct.pack('<HHH', 0, 1, len(entries)))
    for size, data in zip(SIZES, entries):
        directory.extend(struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(data), offset))
        offset += len(data)
    return directory + b''.join(entries)


def main():
    out = Path(__file__).resolve().parents[1] / 'assets' / 'badges'
    out.mkdir(parents=True, exist_ok=True)
    for value in [*range(1, 100), '99plus']:
        (out / f'{value}.ico').write_bytes(icon('99+' if value == '99plus' else str(value)))
    print('Generated 100 original font-free ICO assets (no desktop operations).')


if __name__ == '__main__':
    main()
