#!/usr/bin/env bash
set -euo pipefail
export COPYFILE_DISABLE=1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSION_INPUT="${1:-}"
OUTPUT_DIR="${2:-${PROJECT_ROOT}/release}"
PACKAGE_REVISION="${PACKAGE_REVISION:-1}"
ARCH="${ARCH:-x86_64}"
[ -n "$VERSION_INPUT" ] || { echo "VERSION is required (for example: 4.0.6 or 4.1.0-beta.1)" >&2; exit 2; }
CLEAN_VERSION="${VERSION_INPUT#v}"
DSM_VERSION="$(bun "$SCRIPT_DIR/version.ts" "$CLEAN_VERSION" "$PACKAGE_REVISION")"
[ "$ARCH" = x86_64 ] || { echo "Unsupported Synology architecture: $ARCH (supported: x86_64)" >&2; exit 2; }
SPK_VERSION="${CLEAN_VERSION}-${PACKAGE_REVISION}"
SPK_FILENAME="exelearning-${SPK_VERSION}-${ARCH}.spk"
BINARY="${STANDALONE_BINARY:-${PROJECT_ROOT}/dist/exelearning-server-linux}"
[ -x "$BINARY" ] || { echo "Native server not found or not executable: $BINARY. Run 'bun scripts/build-standalone.js linux-x64 --synology'." >&2; exit 2; }
[ "$(od -An -N6 -tx1 "$BINARY" | tr -d ' \n')" = 7f454c460201 ] &&
    [ "$(od -An -j18 -N2 -tx1 "$BINARY" | tr -d ' \n')" = 3e00 ] || {
    echo 'Native server must be a little-endian x86_64 ELF executable' >&2; exit 2;
}
mkdir -p "$OUTPUT_DIR"
STAGE_DIR="$(mktemp -d -t exelearning-spk-XXXXXX)"
trap 'rm -rf "$STAGE_DIR"' EXIT
mkdir -p "$STAGE_DIR/package/app/synology" "$STAGE_DIR/package/ui/images" "$STAGE_DIR/conf" "$STAGE_DIR/scripts" "$STAGE_DIR/WIZARD_UIFILES"
install -m 755 "$BINARY" "$STAGE_DIR/package/app/exelearning-server"
bun "$SCRIPT_DIR/stage-runtime.ts" "$STAGE_DIR/package/app"
for runtime_dir in public views translations; do
    [ -d "$PROJECT_ROOT/$runtime_dir" ] || { echo "Missing runtime directory: $runtime_dir" >&2; exit 2; }
    cp -R "$PROJECT_ROOT/$runtime_dir" "$STAGE_DIR/package/app/$runtime_dir"
done
find "$STAGE_DIR/package/app" -type f \( -name '*.test.js' -o -name '*.spec.js' -o -name '*.map' \) -delete
install -m 644 "$PROJECT_ROOT/package.json" "$STAGE_DIR/package/app/package.json"
printf '%s\n' "$CLEAN_VERSION" > "$STAGE_DIR/package/app/VERSION"
install -m 644 "$SCRIPT_DIR/conf/nginx.conf" "$STAGE_DIR/package/app/synology/nginx.conf"
install -m 644 "$SCRIPT_DIR/ui/config" "$STAGE_DIR/package/ui/config"
install -m 755 "$SCRIPT_DIR/ui/auth.cgi" "$STAGE_DIR/package/ui/auth.cgi"
install -m 644 "$SCRIPT_DIR/ui/auth.js" "$STAGE_DIR/package/ui/auth.js"
install -m 644 "$SCRIPT_DIR/PACKAGE_ICON.PNG" "$STAGE_DIR/package/ui/images/icon.png"
install -m 644 "$SCRIPT_DIR/PACKAGE_ICON.PNG" "$STAGE_DIR/package/ui/images/icon_64.png"
install -m 644 "$SCRIPT_DIR/PACKAGE_ICON_256.PNG" "$STAGE_DIR/package/ui/images/icon_256.png"
cp "$SCRIPT_DIR"/conf/* "$STAGE_DIR/conf/"
cp "$SCRIPT_DIR"/scripts/* "$STAGE_DIR/scripts/"
cp "$SCRIPT_DIR"/WIZARD_UIFILES/* "$STAGE_DIR/WIZARD_UIFILES/"
chmod 755 "$STAGE_DIR/scripts"/*
install -m 644 "$SCRIPT_DIR/PACKAGE_ICON.PNG" "$STAGE_DIR/PACKAGE_ICON.PNG"
install -m 644 "$SCRIPT_DIR/PACKAGE_ICON_256.PNG" "$STAGE_DIR/PACKAGE_ICON_256.PNG"
find "$STAGE_DIR" -type f \( -name '.DS_Store' -o -name '._*' \) -delete
EPOCH="${SOURCE_DATE_EPOCH:-$(git -C "$PROJECT_ROOT" show -s --format=%ct HEAD 2>/dev/null || echo 0)}"
tar_create() {
    local output="$1" compression="$2" directory="$3"; shift 3
    if tar --version 2>/dev/null | grep -q 'GNU tar'; then
        tar --sort=name --mtime="@$EPOCH" --owner=0 --group=0 --numeric-owner --format=ustar "$compression" "$output" -C "$directory" "$@"
    else
        find "$directory" -exec touch -h -t 197001010000 {} + 2>/dev/null || true
        tar --no-xattrs --no-acls --no-fflags "$compression" "$output" -C "$directory" "$@"
    fi
}
tar_create "$STAGE_DIR/package.tgz" -czf "$STAGE_DIR/package" .
rm -rf "$STAGE_DIR/package"
EXTRACT_SIZE="$(gzip -dc "$STAGE_DIR/package.tgz" | wc -c | tr -d ' ')"
EXTRACT_SIZE="$(( (EXTRACT_SIZE + 1023) / 1024 ))"
sed -e "s/{{VERSION}}/${DSM_VERSION}/g" -e "s/{{APP_VERSION}}/${CLEAN_VERSION}/g" -e "s/{{EXTRACT_SIZE}}/${EXTRACT_SIZE}/g" "$SCRIPT_DIR/INFO.template" > "$STAGE_DIR/INFO"
SPK_PATH="$OUTPUT_DIR/$SPK_FILENAME"
tar_create "$SPK_PATH" -cf "$STAGE_DIR" INFO PACKAGE_ICON.PNG PACKAGE_ICON_256.PNG conf scripts WIZARD_UIFILES package.tgz
outer="$(tar -tf "$SPK_PATH")"
[ "$(printf '%s\n' "$outer" | head -1)" = INFO ]
for required in INFO package.tgz conf/resource conf/nginx.conf scripts/start-stop-status WIZARD_UIFILES/install_uifile; do
    grep -Fxq "$required" <<<"$outer" || { echo "Invalid SPK: missing $required" >&2; exit 1; }
done
payload="$(tar -xOf "$SPK_PATH" package.tgz | tar -tzf -)"
grep -Fxq './app/exelearning-server' <<<"$payload"
grep -Fxq './app/public/' <<<"$payload"
if grep -Eqi 'docker-compose|docker-project' <<<"$outer${payload}"; then echo 'Invalid SPK: Docker runtime content detected' >&2; exit 1; fi
( cd "$OUTPUT_DIR" && sha256sum "$SPK_FILENAME" > "$SPK_FILENAME.sha256" && sha256sum --check "$SPK_FILENAME.sha256" )
echo "Synology SPK: $SPK_PATH"
