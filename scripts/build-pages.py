"""Package only the public browser app for GitHub Pages, without dependencies."""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "out" / "pages"
MARKER_NAME = ".ufficio-pages-generated"
MARKER = "Ufficio D'Avolio GitHub Pages output v1\n"
PUBLIC_FILES = (
    "app.js",
    "completed.js",
    "mail.js",
    "workspace.js",
    "open-tabs.js",
    "open-tabs-data.js",
    "styles.css",
    "logo-davolio.png",
    "favicon.svg",
    "Apri-Ufficio.url",
    "estensione-ufficio.zip",
)
NOT_FOUND = """<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pagina non trovata · Ufficio D’Avolio</title></head>
<body><main><h1>Pagina non trovata</h1><p>Il collegamento potrebbe essere cambiato.</p><p><a href="/ufficio-davolio/">Apri Ufficio D’Avolio</a></p></main></body>
</html>
"""


def read_source(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"Sorgente mancante o non regolare: {path}")
    return path.read_bytes()


def build():
    # An explicit allowlist prevents source archives, old reports and credentials
    # from accidentally becoming public through a recursive directory copy.
    files = {"index.html": read_source(ROOT / "app" / "office.html")}
    files.update({name: read_source(ROOT / "public" / name) for name in PUBLIC_FILES})
    files[".nojekyll"] = b""
    files["404.html"] = NOT_FOUND.encode("utf-8")

    # Never follow output symlinks or clear a directory owned by another task.
    if OUTPUT.parent.is_symlink() or OUTPUT.is_symlink():
        raise ValueError("La destinazione out/pages non può essere un collegamento simbolico.")
    if OUTPUT.exists():
        if not OUTPUT.is_dir():
            raise ValueError(f"La destinazione non è una cartella: {OUTPUT}")
        entries = list(OUTPUT.iterdir())
        marker = OUTPUT / MARKER_NAME
        if entries and (
            marker.is_symlink()
            or not marker.is_file()
            or marker.read_text(encoding="utf-8") != MARKER
        ):
            raise ValueError("out/pages contiene file non riconosciuti; nessun file è stato modificato.")
        allowed = set(files) | {MARKER_NAME}
        for entry in entries:
            if entry.name not in allowed or entry.is_symlink() or not entry.is_file():
                raise ValueError(f"File inatteso in out/pages: {entry.name}; nessun file è stato modificato.")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / MARKER_NAME).write_text(MARKER, encoding="utf-8")
    for name, content in files.items():
        (OUTPUT / name).write_bytes(content)
    print(f"GitHub Pages: {OUTPUT} ({len(files)} file pubblicabili)")


if __name__ == "__main__":
    try:
        build()
    except (OSError, ValueError) as error:
        print(f"Build interrotta: {error}", file=sys.stderr)
        sys.exit(1)
