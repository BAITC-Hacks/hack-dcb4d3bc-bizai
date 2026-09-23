#!/bin/bash
set -euo pipefail
if [ "$(id -u)" != 0 ]; then
  echo 'Run this installer as root.' >&2
  exit 1
fi
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CI_ROOT=/var/lib/bizai-ci
install -d -m 700 "$CI_ROOT" "$CI_ROOT/backups"
if ! id bizai-deploy >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /home/bizai-deploy --shell /bin/bash bizai-deploy
fi
if [ ! -f "$CI_ROOT/github-actions-key" ]; then
  ssh-keygen -q -t ed25519 -N '' -C bizai-github-actions -f "$CI_ROOT/github-actions-key"
fi
install -m 755 -o root -g root "$REPO_DIR/deploy/server/deploy-image.py" /usr/local/sbin/bizai-deploy
install -d -m 700 -o bizai-deploy -g bizai-deploy /home/bizai-deploy/.ssh
{
  printf 'restrict,command="/usr/bin/sudo -n /usr/local/sbin/bizai-deploy" '
  cat "$CI_ROOT/github-actions-key.pub"
} > /home/bizai-deploy/.ssh/authorized_keys
chown bizai-deploy:bizai-deploy /home/bizai-deploy/.ssh/authorized_keys
chmod 600 /home/bizai-deploy/.ssh/authorized_keys
printf 'bizai-deploy ALL=(root) NOPASSWD: /usr/local/sbin/bizai-deploy ""\n' > "$CI_ROOT/sudoers"
visudo -cf "$CI_ROOT/sudoers"
install -m 440 -o root -g root "$CI_ROOT/sudoers" /etc/sudoers.d/bizai-deploy
cat > /etc/ssh/sshd_config.d/70-bizai-deploy.conf <<'CONFIG'
Match User bizai-deploy
    AuthenticationMethods publickey
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    AllowTcpForwarding no
    X11Forwarding no
    PermitTTY no
Match all
CONFIG
sshd -t
systemctl reload ssh
# Host public key is safe to commit; clients verify it instead of accepting any host.
awk '{ print "92.38.48.67 " $1 " " $2 }' /etc/ssh/ssh_host_ed25519_key.pub > "$REPO_DIR/deploy/known_hosts"
chmod 644 "$REPO_DIR/deploy/known_hosts"
printf 'CI receiver ready. Private key remains in %s/github-actions-key\n' "$CI_ROOT"
