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
passthrough-headers: true

# Vetta owns retry classification, backoff, cancellation, and user-visible errors.
# Each incoming request therefore reaches at most one CPA credential attempt.
request-retry: 0
max-retry-credentials: 1
max-retry-interval: 0

quota-exceeded:
  switch-project: false
  switch-preview-model: false
  antigravity-credits: false

plugins:
  enabled: true
  dir: '${VETTA_SERVICE_RUNTIME_DIR}/plugins'
  configs:
    gemini-cli:
      enabled: true
      priority: 10

routing:
  strategy: "round-robin"
  # Keep every model call from one Vetta conversation on the same healthy account.
  # CPA automatically fails over and rebinds when that credential is unavailable.
  session-affinity: true
  session-affinity-ttl: "1h"
