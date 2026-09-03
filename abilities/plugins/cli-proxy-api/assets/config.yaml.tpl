host: "127.0.0.1"
port: ${VETTA_SERVICE_PORT}

remote-management:
  allow-remote: false
  secret-key: "${VETTA_SERVICE_SECRET_MANAGEMENT_KEY}"
  disable-control-panel: true

auth-dir: '${VETTA_SERVICE_DATA_DIR}/auths'
api-keys:
  - "${VETTA_SERVICE_SECRET_API_KEY}"

debug: false
logging-to-file: false
usage-statistics-enabled: false

plugins:
  enabled: true
  dir: '${VETTA_SERVICE_RUNTIME_DIR}/plugins'
  configs:
    gemini-cli:
      enabled: true
      priority: 10

routing:
  strategy: "round-robin"
