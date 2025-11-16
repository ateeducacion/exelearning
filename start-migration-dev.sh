#!/bin/bash

# Development script for Strangler Fig migration
# This script starts all necessary services for the migration

echo "========================================="
echo "Starting eXeLearning Migration Development"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill any existing processes on our ports
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:8080 | xargs kill -9 2>/dev/null

# Function to check if a service is running
check_service() {
    local port=$1
    local service=$2
    if lsof -i:$port >/dev/null 2>&1; then
        echo -e "${GREEN}✓ $service is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}✗ $service is not running on port $port${NC}"
        return 1
    fi
}

# Start Symfony (PHP backend)
echo -e "${YELLOW}Starting Symfony backend...${NC}"
symfony server:start --port=8080 --no-tls --daemon &
SYMFONY_PID=$!

# Start NestJS backend
echo -e "${YELLOW}Starting NestJS backend...${NC}"
cd nest-backend && npm run start:dev &
NESTJS_PID=$!
cd ..

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Start the proxy server
echo -e "${YELLOW}Starting Strangler Fig proxy...${NC}"
node proxy-server.js &
PROXY_PID=$!

# Wait a bit more for proxy to initialize
sleep 2

echo ""
echo "========================================="
echo "Service Status:"
echo "========================================="

check_service 8080 "Symfony"
check_service 3001 "NestJS"
check_service 3000 "Proxy"

echo ""
echo "========================================="
echo "Migration URLs:"
echo "========================================="
echo -e "${GREEN}Main Application (via proxy): http://localhost:3000${NC}"
echo "Symfony (direct): http://localhost:8080"
echo "NestJS (direct): http://localhost:3001"
echo ""
echo "Test endpoints:"
echo "  - http://localhost:3000/healthcheck (→ NestJS)"
echo "  - http://localhost:3000/login (→ Symfony)"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping all services...${NC}"
    kill $SYMFONY_PID 2>/dev/null
    kill $NESTJS_PID 2>/dev/null
    kill $PROXY_PID 2>/dev/null
    symfony server:stop 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:8080 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup INT

# Keep script running
while true; do
    sleep 1
done