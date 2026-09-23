# BizAI deployment and CI/CD

Live URL: http://92.38.48.67

## Current deployment

- Namespace: `site`; Deployment/Service/Ingress: `bizai`.
- Internal HTTP: `bizai.site.svc.cluster.local:3000`.
- One replica, `Recreate` updates: expect a short interruption during deployments.
- Request 250m CPU / 256Mi RAM; limit 1 CPU / 1Gi RAM.
- PVC `site/bizai-data`, 5Gi, PV `site-bizai`, reclaim policy Retain.
- SQLite: `/srv/site-data/bizai/career-quest.sqlite` on the host, mounted at `/app/.data`.
- PostgreSQL and MinIO remain separate; the current app uses SQLite.
- The public entry page is the repository's demo role picker, including HR. Use synthetic data.
- HTTP currently uses `COOKIE_SECURE=false`; change this to true when HTTPS is configured.

The first deployment uses the previously validated local image
`localhost/site/bizai:bootstrap-09b9f02`. This packages source commit `09b9f02`
plus the Dockerfile/standalone changes that were prepared on the server.

## How automatic deployment works

GitHub-hosted runners execute the Dockerfile `test` stage on PRs and main.
After tests pass on main, they build an AMD64 runtime image, stream it over SSH,
and the server imports it into the k3s containerd image store. No container
registry credentials are needed. `workflow_dispatch` can retry deployment of main.
PRs never receive the deployment key or deploy.

The SSH account `bizai-deploy` has a forced command. It cannot run arbitrary
shell commands or open tunnels. Its private key is installed only as a GitHub
Actions secret; it is not in this repository. The committed `known_hosts`
contains the server's public host key. Changes to this host key must be verified
on the server before updating this file.

The server checks the commit SHA and the archive's image tag, rejects archives
over 1 GiB uncompressed, serializes deployments, takes a consistent SQLite
backup, updates the image, waits for readiness, and checks HTTP. On failure it
restores the previous image. It does not overwrite or automatically restore
SQLite data. Database schema migrations need an explicit compatible plan.

Server paths:
- `/usr/local/sbin/bizai-deploy`: root-owned deployment receiver.
- `/var/lib/bizai-ci/github-actions-key`: private CI SSH key (root only).
- `/var/lib/bizai-ci/backups`: SQLite backups before updates (local disk only).
- `/var/lib/bizai-ci/last-deploy.json`: last successful release information.
- `/var/lib/bizai-ci/deploy.lock`: serializes incoming deployments.

Monitor disk use; image cache and local backups consume the same disk. No
external backup destination or automatic backup deletion is configured.

## Enable GitHub Actions from the Mac

Run in your local repository, authenticated to GitHub via `gh auth login`.
First copy only the new deployment/workflow files from the server (not its `.git`):

```bash
git pull --rebase origin main
mkdir -p .github/workflows deploy
scp root@92.38.48.67:/root/hack-dcb4d3bc-bizai/.github/workflows/deploy.yml .github/workflows/deploy.yml
scp -r root@92.38.48.67:/root/hack-dcb4d3bc-bizai/deploy/. ./deploy/
```

Transfer the private key directly to GitHub Secrets without printing or committing it:

```bash
( set -o pipefail; ssh root@92.38.48.67 'cat /var/lib/bizai-ci/github-actions-key' | gh secret set BIZAI_DEPLOY_SSH_KEY --repo BAITC-Hacks/hack-dcb4d3bc-bizai )
```

This needs repository write permission to manage Actions secrets. If the
organization restricts Actions, an organization/repository administrator must
allow GitHub Actions and the official `actions/checkout` / `docker/*` actions.

Then review and push:

```bash
git status
git diff --check
git add .github/workflows/deploy.yml deploy
git diff --cached --stat
git commit -m "Deploy BizAI to k3s with GitHub Actions"
git push origin main
gh run list --repo BAITC-Hacks/hack-dcb4d3bc-bizai --workflow deploy.yml --limit 5
```

Select the new run ID and follow it:

```bash
gh run watch RUN_ID --repo BAITC-Hacks/hack-dcb4d3bc-bizai --exit-status
```

The server-side receiver has been exercised over SSH locally. A successful
GitHub-hosted workflow still needs verification after these repository steps.

## Server installation / recovery

The checked-in manifests assume the current hostname, IP, storage class and
Traefik installation. Keep existing PVCs and database directories. For a new
host, adjust these references and restore data first.

As root, after importing the bootstrap image:

```bash
mkdir -p /srv/site-data/bizai
k3s kubectl apply -f deploy/k8s/site.yaml
k3s kubectl -n site rollout status deployment/bizai --timeout=240s
bash deploy/server/install.sh
```

The manifest pins the bootstrap image for initial installation. Reapplying it
later resets the image to bootstrap; use `kubectl set image` or the CI workflow
for normal releases. Infrastructure/receiver changes require a reviewed root
installation; CI updates only the app image.

Status / logs:

```bash
k3s kubectl -n site get pods,pvc,svc,ingress
k3s kubectl -n site logs deployment/bizai --tail=100
cat /var/lib/bizai-ci/last-deploy.json
```

Manual image rollback (SQLite contents remain in place):

```bash
k3s kubectl -n site rollout undo deployment/bizai
k3s kubectl -n site rollout status deployment/bizai --timeout=240s
```
