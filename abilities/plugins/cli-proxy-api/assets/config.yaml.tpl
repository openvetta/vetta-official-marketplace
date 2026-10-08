config-version: 8

server:
  host: "127.0.0.1"
  port: ${VETTA_SERVICE_PORT}

management:
  allow-remote: false
  secret-key: "${VETTA_SERVICE_SECRET_MANAGEMENT_KEY}"
  disable-control-panel: true

oauth:
  auth-dir: '${VETTA_SERVICE_DATA_DIR}/auths'
  providers:
    antigravity:
      antigravity-credits: false

access:
  api-keys:
    - "${VETTA_SERVICE_SECRET_API_KEY}"

observability:
  logs:
    debug: false
    logging-to-file: false
  usage:
    usage-statistics-enabled: false

requests:
  passthrough-headers: true

plugins:
  enabled: true
  dir: '${VETTA_SERVICE_RUNTIME_DIR}/plugins'
  configs:
    gemini-cli:
      enabled: true
      priority: 10

routing:
  # Vetta owns retries, backoff, cancellation, and user-visible errors.
  # Each request reaches at most one CPA credential attempt.
  retry:
    request-retry: 0
    max-retry-credentials: 1
    max-retry-interval: 0
  strategy: "round-robin"
  # Keep every model call from one Vetta conversation on the same healthy account.
  # CPA automatically fails over and rebinds when that credential is unavailable.
  session-affinity: true
  session-affinity-ttl: "1h"
  session-affinity-subagents: true
