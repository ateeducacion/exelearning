#!/usr/bin/env bash
set -euo pipefail
spk="${1:?Usage: smoke-test.sh package.spk}"
stage="$(mktemp -d)"
pid=''
cleanup() {
    if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
    rm -rf "$stage"
}
trap cleanup EXIT
tar -tf "$spk"
tar -xf "$spk" -C "$stage"
cat "$stage/INFO"
tar -xzf "$stage/package.tgz" -C "$stage"
grep -Eq '^version="[0-9]+(\.[0-9]+)*-[0-9]+"$' "$stage/INFO"
test -x "$stage/app/exelearning-server"
test -x "$stage/scripts/start-stop-status"
for hook in preinst postinst preupgrade postupgrade preuninst postuninst; do test -x "$stage/scripts/$hook"; done
test -x "$stage/ui/auth.cgi"
test -f "$stage/ui/auth.js"
test -f "$stage/app/node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css"
test -f "$stage/app/views/security/login.njk"
test -d "$stage/app/translations"
test -d "$stage/app/public"
if tar -tzf "$stage/package.tgz" | grep -Ei 'docker-compose|docker-project'; then
    echo 'Obsolete container runtime files found' >&2; exit 1
fi
if grep -Ei 'ContainerManager|Docker' "$stage/INFO" "$stage/conf/resource"; then
    echo 'Obsolete container dependency found' >&2; exit 1
fi
(cd "$(dirname "$spk")" && sha256sum --check "$(basename "$spk").sha256")

# Run only on the supported target; archive validation also runs on macOS.
if [ "$(uname -s)-$(uname -m)" != Linux-x86_64 ]; then exit 0; fi
test "$(id -u)" -ne 0 || { echo 'Run the native smoke test as an unprivileged user' >&2; exit 1; }
port="${SMOKE_PORT:-18085}"
mkdir -p "$stage/state"
secret="$(od -An -N48 -tx1 /dev/urandom | tr -d ' \n')"
(
    cd "$stage/app"
    APP_VERSION="v$(cat VERSION)"
    export APP_VERSION
    export APP_HOST=127.0.0.1 APP_PORT="$port" APP_ONLINE_MODE=1 APP_ENV=prod
    export BASE_PATH=/exelearning STRICT_BASE_PATH_ROUTES=true APP_AUTH_METHODS=synology
    export DB_DRIVER=pdo_sqlite DB_PATH="$stage/state/test.db" FILES_DIR="$stage/state/files"
    export NODE_ENV=production JWT_SECRET="$secret" SYNOLOGY_SSO_SECRET="$secret"
    exec ./exelearning-server > "$stage/server.log" 2>&1
) &
pid=$!
ready=false
for ((attempt=0; attempt<${SMOKE_START_TIMEOUT:-600}; attempt++)); do
    if curl --fail --silent "http://127.0.0.1:$port/exelearning/health" > /dev/null; then ready=true; break; fi
    kill -0 "$pid" 2>/dev/null || { cat "$stage/server.log"; exit 1; }
    sleep 1
done
"$ready" || { cat "$stage/server.log"; exit 1; }
curl --fail --silent "http://127.0.0.1:$port/exelearning/health/db" | grep -q '"database":"connected"'
curl --fail --silent "http://127.0.0.1:$port/exelearning/login" > "$stage/login.html"
grep -q 'login-link-synology' "$stage/login.html"
assets="$(sed -n 's/.*\(src\|href\)="\([^" ]*\.\(css\|js\)\)".*/\2/p' "$stage/login.html")"
test -n "$assets"
while IFS= read -r asset; do
    case "$asset" in
        /exelearning/*) curl --fail --silent "http://127.0.0.1:$port$asset" > /dev/null ;;
        *) echo "Unexpected login asset URL: $asset" >&2; exit 1 ;;
    esac
done <<< "$assets"
curl --fail --silent "http://127.0.0.1:$port/exelearning/libs/bootstrap/bootstrap.bundle.min.js" > /dev/null
test -s "$stage/state/test.db"
echo 'Native server, SQLite, templates and static assets: OK'
