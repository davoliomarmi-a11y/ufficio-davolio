"""Create a reproducible source-only Chrome extension archive."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
source = root / 'browser-extension'
target = root / 'public' / 'estensione-ufficio.zip'
files = ['manifest.json', 'bridge.js', 'worker.js', 'reader.js', 'dom-reader.js', 'README.md']
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(files):
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, (source / name).read_bytes())
print(f'Packaged {len(files)} extension files: {target}')
