"""Make the "base" module of an Android App Bundle from aapt2's --proto-format output and classes.dex.

bundletool expects:  manifest/AndroidManifest.xml, resources.pb, res/..., assets/..., dex/classes.dex
(aapt2 puts the manifest at the top level; everything else keeps its place).

    python3 module.py proto.apk classes.dex base.zip
"""
import sys
import zipfile

src, dex, out = sys.argv[1:4]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        name = 'manifest/AndroidManifest.xml' if info.filename == 'AndroidManifest.xml' else info.filename
        zout.writestr(zipfile.ZipInfo(name, (2024, 1, 1, 0, 0, 0)), zin.read(info.filename), zipfile.ZIP_DEFLATED)
    zout.writestr(zipfile.ZipInfo('dex/classes.dex', (2024, 1, 1, 0, 0, 0)), open(dex, 'rb').read(), zipfile.ZIP_DEFLATED)
names = zipfile.ZipFile(out).namelist()
for need in ('manifest/AndroidManifest.xml', 'resources.pb', 'dex/classes.dex'):
    if need not in names:
        sys.exit(f'module.py: {need} missing from {out}')
