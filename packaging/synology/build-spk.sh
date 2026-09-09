#!/usr/bin/env bash
set -euo pipefail

# Ensure macOS bsdtar does not include ._* metadata files or extended attributes
export COPYFILE_DISABLE=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

VERSION_INPUT="${1:-latest}"

# Strip leading 'v' for SPK metadata version
CLEAN_VERSION="${VERSION_INPUT#v}"

if [ "$CLEAN_VERSION" = "latest" ] || [ -z "$CLEAN_VERSION" ]; then
    # Extract version from package.json or fallback
    PKG_VER="$(node -p "try { require('${PROJECT_ROOT}/package.json').version } catch(e) { '4.0.4' }" 2>/dev/null || echo "4.0.4")"
    BASE_VERSION="${PKG_VER#v}"
    SPK_VERSION="${BASE_VERSION}-0001"
    DOCKER_TAG="latest"
elif [[ "$CLEAN_VERSION" =~ - ]]; then
    BASE_VERSION="$CLEAN_VERSION"
    SPK_VERSION="$BASE_VERSION"
    DOCKER_TAG="${DOCKER_TAG:-$VERSION_INPUT}"
else
    BASE_VERSION="$CLEAN_VERSION"
    SPK_VERSION="${BASE_VERSION}-0001"
    DOCKER_TAG="${DOCKER_TAG:-$VERSION_INPUT}"
fi

OUTPUT_DIR="${2:-${PROJECT_ROOT}/release}"
mkdir -p "$OUTPUT_DIR"

STAGE_DIR="$(mktemp -d -t exelearning-spk-XXXXXX)"
cleanup() {
    rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

echo "==> Building Synology SPK for eXeLearning ${SPK_VERSION} (Docker image: exelearning/exelearning:${DOCKER_TAG})..."

# 1. Prepare stage directories
mkdir -p "${STAGE_DIR}/package/docker"
mkdir -p "${STAGE_DIR}/package/ui/images"
mkdir -p "${STAGE_DIR}/conf"
mkdir -p "${STAGE_DIR}/scripts"

# 2. Template and copy INFO
sed "s/{{VERSION}}/${SPK_VERSION}/g" "${SCRIPT_DIR}/INFO.template" > "${STAGE_DIR}/INFO"

# 3. Copy icons
if [ -f "${SCRIPT_DIR}/PACKAGE_ICON.PNG" ]; then
    cp "${SCRIPT_DIR}/PACKAGE_ICON.PNG" "${STAGE_DIR}/PACKAGE_ICON.PNG"
fi
if [ -f "${SCRIPT_DIR}/PACKAGE_ICON_256.PNG" ]; then
    cp "${SCRIPT_DIR}/PACKAGE_ICON_256.PNG" "${STAGE_DIR}/PACKAGE_ICON_256.PNG"
fi

# 4. Copy conf files
cp "${SCRIPT_DIR}/conf/privilege" "${STAGE_DIR}/conf/privilege"
cp "${SCRIPT_DIR}/conf/resource" "${STAGE_DIR}/conf/resource"

# 5. Copy and set executable permissions for scripts
if [ -d "${SCRIPT_DIR}/scripts" ]; then
    cp -r "${SCRIPT_DIR}/scripts/"* "${STAGE_DIR}/scripts/" 2>/dev/null || true
    chmod 755 "${STAGE_DIR}/scripts/"* 2>/dev/null || true
fi

# 6. Prepare package payload (docker/docker-compose.yml and DSM UI integration)
sed "s/\${VERSION}/${DOCKER_TAG}/g" "${SCRIPT_DIR}/docker/docker-compose.yml.tpl" > "${STAGE_DIR}/package/docker/docker-compose.yml"

if [ -f "${SCRIPT_DIR}/ui/config" ]; then
    cp "${SCRIPT_DIR}/ui/config" "${STAGE_DIR}/package/ui/config"
fi
if [ -f "${SCRIPT_DIR}/PACKAGE_ICON.PNG" ]; then
    cp "${SCRIPT_DIR}/PACKAGE_ICON.PNG" "${STAGE_DIR}/package/ui/images/icon_64.png"
    cp "${SCRIPT_DIR}/PACKAGE_ICON.PNG" "${STAGE_DIR}/package/ui/images/icon.png"
fi
if [ -f "${SCRIPT_DIR}/PACKAGE_ICON_256.PNG" ]; then
    cp "${SCRIPT_DIR}/PACKAGE_ICON_256.PNG" "${STAGE_DIR}/package/ui/images/icon_256.png"
fi

# Check individual tar support for cross-platform Linux (GNU tar) and macOS (bsdtar)
TAR_EXTRA_OPTS=()
if tar --help 2>&1 | grep -q -- '--no-xattrs'; then
    TAR_EXTRA_OPTS+=( "--no-xattrs" )
fi
if tar --help 2>&1 | grep -q -- '--no-mac-metadata'; then
    TAR_EXTRA_OPTS+=( "--no-mac-metadata" )
fi

# Create package.tgz in standard format
(
    cd "${STAGE_DIR}/package"
    TAR_CMD=( "tar" "-czf" "${STAGE_DIR}/package.tgz" )
    if [ ${#TAR_EXTRA_OPTS[@]} -gt 0 ]; then
        TAR_CMD+=( "${TAR_EXTRA_OPTS[@]}" )
    fi
    "${TAR_CMD[@]}" *
)
rm -rf "${STAGE_DIR}/package"

# 7. Create final SPK archive (tar without compression, ustar format, INFO strictly first)
SPK_FILENAME="exelearning-${BASE_VERSION}.spk"
SPK_PATH="${OUTPUT_DIR}/${SPK_FILENAME}"

TAR_ITEMS=( "INFO" )

if [ -f "${STAGE_DIR}/PACKAGE_ICON.PNG" ]; then
    TAR_ITEMS+=( "PACKAGE_ICON.PNG" )
fi
if [ -f "${STAGE_DIR}/PACKAGE_ICON_256.PNG" ]; then
    TAR_ITEMS+=( "PACKAGE_ICON_256.PNG" )
fi
if [ -d "${STAGE_DIR}/conf" ]; then
    TAR_ITEMS+=( "conf" )
fi
if [ -d "${STAGE_DIR}/scripts" ]; then
    TAR_ITEMS+=( "scripts" )
fi
if [ -f "${STAGE_DIR}/package.tgz" ]; then
    TAR_ITEMS+=( "package.tgz" )
fi

(
    cd "${STAGE_DIR}"
    SPK_CMD=( "tar" "-cf" "${SPK_PATH}" )
    if tar --help 2>&1 | grep -q -- '--format'; then
        SPK_CMD+=( "--format" "ustar" )
    fi
    if [ ${#TAR_EXTRA_OPTS[@]} -gt 0 ]; then
        SPK_CMD+=( "${TAR_EXTRA_OPTS[@]}" )
    fi
    "${SPK_CMD[@]}" "${TAR_ITEMS[@]}"
)

echo "==> Synology SPK created successfully: ${SPK_PATH}"
