#!/bin/sh
#
# NestJS configuration script for migration
#
set -eo pipefail

# Colors for messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log functions
log()  { printf "%b%s%b\n" "${GREEN}" "$1" "${NC}"; }
warn() { printf "%b%s%b\n" "${YELLOW}" "$1" "${NC}"; }
err()  { printf "%b%s%b\n" "${RED}"   "$1" "${NC}" 1>&2; }

# Function to check the availability of a database
check_db_availability() {
    local db_host="$1"
    local db_port="$2"
    echo -e "${GREEN}Waiting for $db_host:$db_port to be ready...${NC}"
    while ! nc -w 1 "$db_host" "$db_port" > /dev/null 2>&1; do
        # Show some progress
        echo -n '.'
        sleep 1
    done
    echo -e "${GREEN}\n\nGreat, $db_host is ready!${NC}"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        err "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        err "npm is not installed. Please install npm first."
        exit 1
    fi

    log "Node.js $(node -v) and npm $(npm -v) found"
}

# --- Main ---

log "Starting NestJS configuration for migration..."

# Check Node.js
check_node

# Navigate to nest-backend directory
cd nest-backend

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    log "Installing NestJS dependencies..."
    npm install
else
    log "Dependencies already installed"
fi

# If DB_HOST is set, check the availability of the database
if [ -n "$DB_HOST" ]; then
    check_db_availability "$DB_HOST" "$DB_PORT"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    log "Creating .env file for NestJS..."
    cat > .env << EOL
# NestJS Configuration
NODE_ENV=development
NEST_PORT=3001

# Database configuration (matching Symfony)
DB_DRIVER=${DB_DRIVER:-pdo_sqlite}
DB_HOST=${DB_HOST:-}
DB_PORT=${DB_PORT:-}
DB_NAME=${DB_NAME:-}
DB_USER=${DB_USER:-}
DB_PASSWORD=${DB_PASSWORD:-}
DB_PATH=${DB_PATH:-../data/exelearning.db}

# JWT Configuration
JWT_SECRET=${JWT_SECRET:-your-secret-key-change-in-production}

# WebSocket Configuration
WEBSOCKET_URL=${WEBSOCKET_URL:-ws://localhost:3001}
WEBSOCKET_PORT=${WEBSOCKET_PORT:-3001}

# Test User (matching Symfony)
TEST_USER_EMAIL=${TEST_USER_EMAIL:-user@exelearning.net}
TEST_USER_PASSWORD=${TEST_USER_PASSWORD:-1234}
TEST_USER_USERNAME=${TEST_USER_USERNAME:-user}

# App Configuration
APP_VERSION=${APP_VERSION:-3.0.0}
APP_SECRET=${APP_SECRET:-CHANGE_THIS_TO_A_SECRET}
EOL
    log ".env file created"
else
    log ".env file already exists"
fi

# Build TypeScript
log "Building TypeScript..."
npm run build

# Setup database directory
if [ "$DB_DRIVER" = "pdo_sqlite" ] || [ -z "$DB_DRIVER" ]; then
    DB_DIR=$(dirname "${DB_PATH:-../data/exelearning.db}")
    if [ ! -d "$DB_DIR" ]; then
        log "Creating database directory: $DB_DIR"
        mkdir -p "$DB_DIR"
    fi
fi

# TODO: When TypeORM migrations are ready, uncomment this section
# log "Running database migrations..."
# npm run typeorm migration:run

# TODO: When User entity is ready, create test user
# log "Creating test user..."
# npm run create:user -- "${TEST_USER_EMAIL}" "${TEST_USER_PASSWORD}" "${TEST_USER_USERNAME}"

# Clear any cache (if applicable)
log "Clearing cache..."
rm -rf dist/.cache 2>/dev/null || true

# Verify the build
if [ -f "dist/main.js" ]; then
    log "NestJS build successful"
else
    err "NestJS build failed - dist/main.js not found"
    exit 1
fi

# Execute post-configuration commands if set
if [ -n "$POST_CONFIGURE_COMMANDS" ]; then
    log "Executing post-configure commands..."
    eval "$POST_CONFIGURE_COMMANDS"
fi

log "NestJS has been successfully configured."
log ""
log "You can now start the NestJS server with:"
log "  npm run start:dev     (development with hot reload)"
log "  npm run start:prod    (production)"
log ""
log "The server will run on port ${NEST_PORT:-3001}"
log ""
log "To use with the Strangler Fig pattern:"
log "  1. Start Symfony: symfony server:start --port=8080"
log "  2. Start NestJS: npm run start:dev"
log "  3. Start Proxy: node ../proxy-server.js"
log ""

# Always return 0 (success)
exit 0