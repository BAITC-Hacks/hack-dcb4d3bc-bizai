#!/usr/bin/python3
"""Forced SSH command: receive SHA + gzip(Docker archive), deploy only site/bizai."""
import datetime
import fcntl
import gzip
import io
import json
import os
import pathlib
import re
import signal
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request

ROOT = pathlib.Path('/var/lib/bizai-ci')
K = ['/usr/local/bin/k3s', 'kubectl', '-n', 'site']
PUBLIC_URL = 'http://92.38.48.67/'

def run(args, capture=False):
    return subprocess.run(args, check=True, text=True, capture_output=capture)

def main():
    if os.geteuid() != 0 or len(sys.argv) != 1:
        raise RuntimeError('Run only through the installed forced SSH command')
    os.umask(0o077)
    ROOT.mkdir(mode=0o700, exist_ok=True)
    with (ROOT / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        signal.alarm(600)
        revision = sys.stdin.buffer.readline(128).decode('ascii').strip()
        if not re.fullmatch(r'[0-9a-f]{40}', revision):
            raise RuntimeError('Expected a 40-character commit SHA')
        image = 'localhost/site/bizai:' + revision
        with tempfile.TemporaryDirectory(prefix='incoming-', dir=ROOT) as directory:
            archive = pathlib.Path(directory) / 'image.tar'
            size = 0
            with gzip.GzipFile(fileobj=sys.stdin.buffer, mode='rb') as compressed, archive.open('wb') as output:
                while chunk := compressed.read(1024 * 1024):
                    size += len(chunk)
                    if size > 1024**3:
                        raise RuntimeError('Image archive exceeds 1 GiB')
                    output.write(chunk)
            signal.alarm(0)
            # Validate tags before import so CI cannot overwrite unrelated images.
            with tarfile.open(archive) as tar:
                members = [m for m in tar.getmembers() if m.name == 'manifest.json']
                if len(members) != 1 or members[0].size > 1024**2:
                    raise RuntimeError('Expected one small Docker manifest.json')
                manifest = json.load(tar.extractfile(members[0]))
                if len(manifest) != 1 or manifest[0].get('RepoTags') != [image]:
                    raise RuntimeError('Archive must contain only the requested BizAI image tag')
                # Docker/BuildKit archives can also contain an OCI index with
                # extra names. Import only the validated Docker manifest/files.
                normalized = pathlib.Path(directory) / 'validated-image.tar'
                required = [manifest[0]['Config'], *manifest[0]['Layers']]
                with tarfile.open(normalized, 'w') as output:
                    content = json.dumps(manifest).encode()
                    header = tarfile.TarInfo('manifest.json')
                    header.size = len(content)
                    output.addfile(header, io.BytesIO(content))
                    for name in dict.fromkeys(required):
                        path = pathlib.PurePosixPath(name)
                        if path.is_absolute() or '..' in path.parts or name == 'manifest.json':
                            raise RuntimeError('Invalid archive member path')
                        matches = [member for member in tar.getmembers() if member.name == name]
                        if len(matches) != 1 or not matches[0].isfile():
                            raise RuntimeError('Invalid image config/layer member')
                        output.addfile(matches[0], tar.extractfile(matches[0]))
            current = json.loads(run(K + ['get', 'deployment', 'bizai', '-o', 'json'], True).stdout)
            previous = next(c['image'] for c in current['spec']['template']['spec']['containers'] if c['name'] == 'app')
            same_tag = previous == image
            if same_tag:
                # A rerun can rebuild the same commit against a newer base image.
                # Preserve the old descriptor before importing over its tag.
                rollback = 'localhost/site/bizai:rollback-' + str(time.time_ns())
                run(['/usr/local/bin/k3s', 'ctr', 'images', 'tag', previous, rollback])
                previous = rollback
            run(['/usr/local/bin/k3s', 'ctr', 'images', 'import', str(normalized)])
            db_path = pathlib.Path('/srv/site-data/bizai/career-quest.sqlite')
            if db_path.exists():
                backups = ROOT / 'backups'
                backups.mkdir(mode=0o700, exist_ok=True)
                stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
                backup = backups / (stamp + '-before-' + revision + '.sqlite')
                source = sqlite3.connect('file:' + str(db_path) + '?mode=ro', uri=True, timeout=15)
                target = sqlite3.connect(backup)
                try:
                    source.backup(target)
                finally:
                    target.close()
                    source.close()
                print('SQLite backup:', backup, flush=True)
            try:
                run(K + ['set', 'image', 'deployment/bizai', 'app=' + image])
                if same_tag:
                    run(K + ['rollout', 'restart', 'deployment/bizai'])
                run(K + ['rollout', 'status', 'deployment/bizai', '--timeout=240s'])
                for attempt in range(10):
                    try:
                        with urllib.request.urlopen(PUBLIC_URL, timeout=15) as response:
                            if response.status != 200:
                                raise RuntimeError('Unexpected HTTP status')
                        break
                    except Exception:
                        if attempt == 9:
                            raise
                        time.sleep(2)
            except Exception:
                print('Deploy failed; restoring previous image:', previous, flush=True)
                run(K + ['set', 'image', 'deployment/bizai', 'app=' + previous])
                run(K + ['rollout', 'status', 'deployment/bizai', '--timeout=240s'])
                raise
            record = {'revision': revision, 'image': image, 'previous_image': previous,
                      'deployed_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
            (ROOT / 'last-deploy.json').write_text(json.dumps(record, indent=2) + '\n')
            print('DEPLOY OK:', revision, PUBLIC_URL, flush=True)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('DEPLOY ERROR:', error, file=sys.stderr, flush=True)
        sys.exit(1)
