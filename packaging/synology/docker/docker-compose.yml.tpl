services:
  exelearning:
    image: exelearning/exelearning:${VERSION}
    container_name: exelearning
    restart: unless-stopped
    ports:
      - "${PORT:-8085}:8080"
    environment:
      - APP_ENV=prod
      - NODE_ENV=production
      - FILES_DIR=/mnt/data/
      - DB_PATH=/mnt/data/exelearning.db
      - DB_DRIVER=pdo_sqlite
      - APP_AUTH_METHODS=${APP_AUTH_METHODS:-password,guest}
      - AUTH_CREATE_USERS=${AUTH_CREATE_USERS:-true}
      - OIDC_ISSUER=${OIDC_ISSUER:-}
      - OIDC_CLIENT_ID=${OIDC_CLIENT_ID:-}
      - OIDC_CLIENT_SECRET=${OIDC_CLIENT_SECRET:-}
      - OIDC_SCOPE=${OIDC_SCOPE:-openid email profile}
    volumes:
      - exelearning_data:/mnt/data
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8080/healthcheck || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  exelearning_data:
    name: exelearning_data
