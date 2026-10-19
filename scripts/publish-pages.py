"""Publish generated assets using the existing Git authentication and a temporary index."""
from pathlib import Path
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'out' / 'pages'


def git(*args, **kwargs):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True, **kwargs).strip()


def publish():
    marker = OUTPUT / '.ufficio-pages-generated'
    if not marker.is_file() or marker.is_symlink() or marker.read_text() != "Ufficio D'Avolio GitHub Pages output v1\n":
        raise SystemExit('Run python scripts/build-pages.py first.')
    names = sorted(path.name for path in OUTPUT.iterdir() if path.name != marker.name)
    expected = {'.nojekyll', '404.html', 'index.html', 'app.js', 'completed.js', 'mail.js', 'workspace.js', 'open-tabs.js', 'open-tabs-data.js', 'styles.css', 'logo-davolio.png', 'favicon.svg', 'Apri-Ufficio.url', 'estensione-ufficio.zip'}
    if set(names) != expected or any((OUTPUT / name).is_symlink() or not (OUTPUT / name).is_file() for name in names):
        raise SystemExit('Unexpected deployment output. Rebuild and inspect out/pages.')
    source = git('rev-parse', '--verify', 'HEAD')
    remote = git('ls-remote', '--heads', 'origin', 'refs/heads/gh-pages')
    parent = None
    if remote:
        git('fetch', '--no-tags', 'origin', 'refs/heads/gh-pages')
        parent = git('rev-parse', '--verify', 'FETCH_HEAD')
    git_dir = git('rev-parse', '--absolute-git-dir')
    runtime = ROOT / '.sites-runtime'
    runtime.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pages-index-', dir=runtime) as temporary:
        environment = os.environ.copy()
        environment['GIT_INDEX_FILE'] = str(Path(temporary) / 'index')
        commands = ['git', f'--git-dir={git_dir}', f'--work-tree={OUTPUT}']
        subprocess.run([*commands, 'read-tree', '--empty'], cwd=OUTPUT, env=environment, check=True)
        subprocess.run([*commands, 'add', '--force', '--', *names], cwd=OUTPUT, env=environment, check=True)
        tree = subprocess.check_output([*commands, 'write-tree'], cwd=OUTPUT, env=environment, text=True).strip()
    if parent and git('rev-parse', f'{parent}^{{tree}}') == tree:
        print(f'GitHub Pages branch already matches generated assets: {parent}')
        return
    args = ['commit-tree', tree]
    if parent:
        args += ['-p', parent]
    commit = git(*args, '-m', f'Publish Ufficio Davolio from {source[:12]}')
    subprocess.run(['git', 'push', 'origin', f'{commit}:refs/heads/gh-pages'], cwd=ROOT, check=True)
    print(f'GitHub Pages branch published: {commit}')


if __name__ == '__main__':
    publish()
