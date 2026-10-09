# Generates static/og.png (1200x630): print-tech OG card — paper field,
# ink header band, stamp-red square. Manual PNG encode (no PIL available).
import struct
import zlib

W, H = 1200, 630

def px(x, y):
    if y < 110:
        return (23, 21, 18)            # ink header band
    if 440 <= x < 760 and 190 <= y < 510:
        return (232, 52, 28)           # stamp square
    if 440 <= x < 760 and (y < 190 or y >= 510):
        return (243, 237, 226)         # paper-2 margin around stamp
    return (250, 246, 239)            # paper

def chunk(t, d):
    c = t + d
    return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

raw = b"".join(b"\x00" + b"".join(bytes(px(x, y)) for x in range(W)) for y in range(H))
png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(raw, 9))
       + chunk(b"IEND", b""))
with open("static/og.png", "wb") as f:
    f.write(png)
print("og.png", len(png), "bytes")
