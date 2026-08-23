#!/usr/bin/env bash
set -euo pipefail

# Ensure macOS does not include ._* metadata files or extended attributes
export COPYFILE_DISABLE=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

VERSION_INPUT="${1:-}"

if [ -z "$VERSION_INPUT" ]; then
    echo "Error: Version is required." >&2
    echo "Usage: $0 <version> [output-dir]" >&2
    echo "Example: $0 v4.0.4" >&2
    exit 1
fi

# Strip leading 'v' for SPK metadata version
BASE_VERSION="${VERSION_INPUT#v}"

if [[ "$BASE_VERSION" =~ - ]]; then
    SPK_VERSION="$BASE_VERSION"
    DOCKER_TAG="${DOCKER_TAG:-$VERSION_INPUT}"
else
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

# Create package.tgz in standard ustar format
(
    cd "${STAGE_DIR}/package"
    TAR_OPTS=( "-czf" "${STAGE_DIR}/package.tgz" )
    if tar --help 2>&1 | grep -q -- '--no-xattrs'; then
        TAR_OPTS+=( "--no-xattrs" "--no-mac-metadata" )
    fi
    tar "${TAR_OPTS[@]}" *
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
    TAR_FLAGS=( "-cf" "${SPK_PATH}" )
    if tar --help 2>&1 | grep -q -- '--format'; then
        TAR_FLAGS+=( "--format" "ustar" )
    fi
    if tar --help 2>&1 | grep -q -- '--no-xattrs'; then
        TAR_FLAGS+=( "--no-xattrs" "--no-mac-metadata" )
    fi
    tar "${TAR_FLAGS[@]}" "${TAR_ITEMS[@]}"
)

echo "==> Synology SPK created successfully: ${SPK_PATH}"
