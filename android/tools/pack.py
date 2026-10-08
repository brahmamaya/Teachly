"""Add classes.dex to the APK made by aapt2 (or just re-align with "-"),
keeping uncompressed files 4-byte aligned."""
import sys
import zipfile

src, dex, out = sys.argv[1:4]
with zipfile.ZipFile(src) as zin, open(out, 'wb') as raw:
    zout = zipfile.ZipFile(raw, 'w')
    items = [(i, zin.read(i.filename)) for i in zin.infolist()]
    if dex != '-':
        items.append((zipfile.ZipInfo('classes.dex', (2024, 1, 1, 0, 0, 0)), open(dex, 'rb').read()))
    for info, data in items:
        zi = zipfile.ZipInfo(info.filename, info.date_time)
        # resources.arsc must stay uncompressed (and aligned) on Android 11+.
        stored = info.filename == 'resources.arsc' or info.filename.endswith('.png') or (info.compress_type == zipfile.ZIP_STORED and info.filename != 'classes.dex')
        zi.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        if stored:
            offset = raw.tell() + 30 + len(zi.filename.encode())
            pad = (4 - offset % 4) % 4
            zi.extra = b'\x00' * pad
        zout.writestr(zi, data)
    zout.close()
