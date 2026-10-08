#!/usr/bin/env python3
"""Exercise the pinned CPA core + Gemini binary with isolated data and a loopback upstream.

No provider account is required. This checks packaging and protocol contracts, not
real OAuth exchanges or provider-side model entitlements.
"""
import argparse
import hashlib
import http.server
import io
import json
import os
from pathlib import Path
import platform
import secrets
import socket
import stat
import subprocess
import tarfile
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile


ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "abilities/plugins/cli-proxy-api"
LIMIT = 256 * 1024 * 1024


def extract_asset(artifact, destination):
    request = urllib.request.Request(artifact["url"], headers={"User-Agent": "vetta-cpa-canary"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read(LIMIT + 1)
    assert len(data) <= LIMIT, "Runtime archive exceeds the download limit"
    assert hashlib.sha256(data).hexdigest() == artifact["sha256"], "Runtime digest mismatch"
    destination.mkdir(parents=True)

    def target(name):
        path = destination / name.replace("\\", "/")
        assert path.resolve().is_relative_to(destination.resolve()), "Archive path escapes destination"
        return path

    if artifact["archive"] == "zip":
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            assert sum(item.file_size for item in archive.infolist()) <= LIMIT
            for item in archive.infolist():
                path = target(item.filename)
                assert not stat.S_ISLNK(item.external_attr >> 16) and not item.flag_bits & 1
                if item.is_dir():
                    path.mkdir(parents=True, exist_ok=True)
                else:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(archive.read(item))
    else:
        assert artifact["archive"] == "tar.gz"
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            members = archive.getmembers()
            assert sum(item.size for item in members) <= LIMIT
            for item in members:
                path = target(item.name)
                assert item.isfile() or item.isdir(), "Unexpected archive entry type"
                if item.isdir():
                    path.mkdir(parents=True, exist_ok=True)
                else:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(archive.extractfile(item).read())
                    path.chmod(item.mode & 0o777)


class Upstream(http.server.BaseHTTPRequestHandler):
    calls = []
    fail = False
    canceled = threading.Event()

    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.calls.append({"path": self.path, "body": body, "authorization": self.headers.get("Authorization")})
        if self.fail:
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":{"message":"canary unavailable","type":"server_error"}}')
            return
        stream = body.get("stream", False)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream" if stream else "application/json")
        self.end_headers()
        base = {"id": "chatcmpl-canary", "created": 1, "model": "vetta-canary"}
        message = {"role": "assistant", "content": "canary-ok"}
        reason = "stop"
        if body.get("tools"):
            message = {"role": "assistant", "content": None, "tool_calls": [
                {"id": "call_canary", "type": "function", "function": {"name": "canary_tool", "arguments": '{"value":1}'}}
            ]}
            reason = "tool_calls"
        if stream:
            chunks = [
                {**base, "object": "chat.completion.chunk", "choices": [{"index": 0, "delta": message, "finish_reason": None}]},
                {**base, "object": "chat.completion.chunk", "choices": [{"index": 0, "delta": {}, "finish_reason": reason}]},
            ]
            if any(message.get("content") == "cancel-canary" for message in body.get("messages", [])):
                try:
                    for _ in range(500):
                        self.wfile.write(("data: " + json.dumps(chunks[0]) + "\n\n").encode())
                        self.wfile.flush()
                        time.sleep(0.02)
                except (BrokenPipeError, ConnectionResetError):
                    self.canceled.set()
                return
            for chunk in chunks:
                self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
            self.wfile.write(b"data: [DONE]\n\n")
        else:
            self.wfile.write(json.dumps({**base, "object": "chat.completion", "choices": [
                {"index": 0, "message": message, "finish_reason": reason}
            ], "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}}).encode())


def run(runtime, platform_tag, rosetta=False):
    lock = json.loads((PLUGIN / "runtime-lock.json").read_text())
    manifest = json.loads((PLUGIN / "plugin.json").read_text())
    service = manifest["providers"]["services"][0]
    for artifact in lock["platforms"][platform_tag]:
        expected = next(item for item in service["runtime"]["platforms"][platform_tag]["artifacts"] if item["destination"] == artifact["destination"])
        assert {key: artifact[key] for key in expected} == expected
        print("Verifying", artifact["url"].rsplit("/", 1)[1], flush=True)
        extract_asset(artifact, runtime / artifact["destination"])
    binary = runtime / service["runtime"]["platforms"][platform_tag]["executable"]
    binary.chmod(0o755)
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    api_key, management_key = secrets.token_hex(32), secrets.token_hex(32)
    auths = runtime / "data" / "auths"
    auths.mkdir(parents=True)
    # Disabled synthetic record checks credential CRUD without a real OAuth grant.
    account_name = "vetta canary.json"
    (auths / account_name).write_text(json.dumps({"type": "codex", "email": "canary@example.invalid", "disabled": True}))
    upstream = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
    thread = threading.Thread(target=upstream.serve_forever, daemon=True)
    thread.start()
    config = (PLUGIN / "assets/config.yaml.tpl").read_text()
    for key, value in {
        "VETTA_SERVICE_PORT": str(port), "VETTA_SERVICE_SECRET_API_KEY": api_key,
        "VETTA_SERVICE_SECRET_MANAGEMENT_KEY": management_key,
        "VETTA_SERVICE_DATA_DIR": (runtime / "data").as_posix(), "VETTA_SERVICE_RUNTIME_DIR": runtime.as_posix(),
    }.items():
        config = config.replace("${" + key + "}", value)
    config += f'''
api-keys:
  openai-compatibility:
    - name: vetta-canary
      base-url: "http://127.0.0.1:{upstream.server_port}/v1"
      proxy-url: direct
      disable-cooling: true
      keys:
        - api-key: canary-upstream-one
        - api-key: canary-upstream-two
      models:
        - name: vetta-canary
'''
    config_path = runtime / "config.yaml"
    config_path.write_text(config)
    config_path.chmod(0o600)
    env = {key: value for key, value in os.environ.items() if key in {
        "PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "LANG", "LC_ALL"
    }}

    local_http = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(path, method="GET", body=None, expected=200, raw=False):
        key = management_key if path.startswith("/v8/management/") else api_key
        headers = {"Authorization": "Bearer " + key, "Content-Type": "application/json"}
        req = urllib.request.Request(f"http://127.0.0.1:{port}" + path, method=method, headers=headers,
                                     data=json.dumps(body).encode() if body is not None else None)
        try:
            response = local_http.open(req, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            result = response.read().decode()
            assert response.code == expected, f"{method} {path}: {response.code}: {result[:300]}"
            return result if raw else json.loads(result)

    command = (["/usr/bin/arch", "-x86_64"] if rosetta else []) + [str(binary), "--config", str(config_path), "--local-model"]
    process = None
    try:
        with (runtime / "runtime.log").open("w") as log:
            process = subprocess.Popen(command,
                                       cwd=runtime, env=env, stdout=log, stderr=subprocess.STDOUT)
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                assert process.poll() is None, "CPA exited before ready"
                try:
                    models = request("/v1/models")["data"]
                    if any(model["id"] == "vetta-canary" for model in models):
                        break
                except (OSError, urllib.error.URLError):
                    pass
                time.sleep(0.2)
            else:
                raise AssertionError("CPA did not register the loopback model")
            plugins = request("/v8/management/plugins")["plugins"]
            gemini = next(item for item in plugins if item["id"] == "gemini-cli")
            assert gemini["registered"] and gemini["effective_enabled"] and gemini["supports_oauth"]
            cfg = request("/v8/management/config")
            assert cfg["routing"]["retry"] == {"request-retry": 0, "max-retry-credentials": 1, "max-retry-interval": 0}
            assert cfg["routing"]["session-affinity-subagents"] is True
            assert cfg["management"]["allow-remote"] is False
            assert cfg["oauth"]["providers"]["antigravity"]["antigravity-credits"] is False
            for channel in ["antigravity", "aistudio", "claude", "codex", "gemini", "kimi", "vertex", "xai", "meta", "devin", "kimi-ai"]:
                assert request("/v8/management/routing/model-definitions/" + channel)["models"]
            files = request("/v8/management/credentials")["files"]
            account = next(item for item in files if item["name"] == account_name)
            assert account["disabled"] is True
            query = "?name=" + urllib.parse.quote(account_name)
            assert "models" in request("/v8/management/credentials/models" + query)
            request("/v8/management/credentials/status", "PATCH", {"name": account_name, "disabled": True})
            request("/v8/management/routing/cooldown/reset", "POST", {"auth_index": account["auth_index"]})
            # Probe proxy uses a local target, never a provider's real quota service.
            probe = request("/v8/management/requests/api-call", "POST", {
                "method": "POST", "url": f"http://127.0.0.1:{upstream.server_port}/probe",
                "header": {"Content-Type": "application/json"}, "data": "{}",
            })
            assert probe["status_code"] == 200 and isinstance(probe["body"], str)
            # An actual process restart must keep the synthetic account on disk.
            process.terminate()
            process.wait(timeout=10)
            process = subprocess.Popen(command, cwd=runtime, env=env, stdout=log, stderr=subprocess.STDOUT)
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                assert process.poll() is None, "CPA exited during restart"
                try:
                    restarted = request("/v8/management/credentials")["files"]
                    if any(item["name"] == account_name for item in restarted):
                        break
                except (OSError, urllib.error.URLError):
                    pass
                time.sleep(0.2)
            else:
                raise AssertionError("Account did not survive CPA restart")
            request("/v8/management/credentials" + query, "DELETE")
            assert not any(item["name"] == account_name for item in request("/v8/management/credentials")["files"])
            protocols = [
                ("/v1/chat/completions", {"model": "vetta-canary", "messages": [{"role": "user", "content": "ping"}]}),
                ("/v1/responses", {"model": "vetta-canary", "input": "ping"}),
                ("/v1/messages", {"model": "vetta-canary", "max_tokens": 16, "messages": [{"role": "user", "content": "ping"}]}),
                ("/v1beta/models/vetta-canary:generateContent", {"contents": [{"role": "user", "parts": [{"text": "ping"}]}]}),
            ]
            for path, body in protocols:
                assert "canary-ok" in request(path, "POST", body, raw=True), path
            chat_path, chat = protocols[0]
            stream = request(chat_path, "POST", {**chat, "stream": True}, raw=True)
            assert "canary-ok" in stream and "[DONE]" in stream
            tool = {"type": "function", "function": {"name": "canary_tool", "parameters": {"type": "object", "properties": {"value": {"type": "integer"}}}}}
            reply = request(chat_path, "POST", {**chat, "tools": [tool]})
            assert reply["choices"][0]["message"]["tool_calls"][0]["function"]["name"] == "canary_tool"
            # Image input survives translation into the upstream request.
            image_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
            request(chat_path, "POST", {**chat, "messages": [{"role": "user", "content": [
                {"type": "text", "text": "Describe"}, {"type": "image_url", "image_url": {"url": image_url}},
            ]}]})
            assert image_url in json.dumps(Upstream.calls[-1]["body"])
            cancel_body = {**chat, "stream": True, "messages": [{"role": "user", "content": "cancel-canary"}]}
            cancel_request = urllib.request.Request(f"http://127.0.0.1:{port}" + chat_path,
                data=json.dumps(cancel_body).encode(), headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"})
            with local_http.open(cancel_request, timeout=10) as response:
                assert response.readline().startswith(b"data:")
            assert Upstream.canceled.wait(8), "Client cancellation did not close the upstream stream"
            assert all(call["authorization"] in {"Bearer canary-upstream-one", "Bearer canary-upstream-two"}
                       for call in Upstream.calls if call["path"] == "/v1/chat/completions")
            before = len(Upstream.calls)
            Upstream.fail = True
            request(chat_path, "POST", chat, expected=503)
            assert len(Upstream.calls) == before + 1, "CPA retried despite Vetta owning retries"
            print(f"PASS {platform_tag}: {lock['version']}; Gemini loaded; v8 config/credentials/probe; four protocols; SSE + cancellation; image input; tools; restart persistence; single attempt")
    except Exception:
        if (runtime / "runtime.log").exists():
            full_log = (runtime / "runtime.log").read_text(errors="replace")
            tail = full_log[:3000] + "\n[log tail]\n" + full_log[-1500:]
            print(tail.replace(api_key, "[client-key]").replace(management_key, "[management-key]"))
        raise
    finally:
        if process is not None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        upstream.shutdown()
        upstream.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-platform")
    parser.add_argument("--rosetta", action="store_true", help="Run locked darwin-x64 binaries on an arm64 Mac via Rosetta")
    args = parser.parse_args()
    system = {"Darwin": "darwin", "Windows": "win32", "Linux": "linux"}[platform.system()]
    arch = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x64", "amd64": "x64"}[platform.machine().lower()]
    tag = system + "-" + arch
    if args.expected_platform:
        assert tag == args.expected_platform, f"Runner mismatch: expected {args.expected_platform}, got {tag}"
    if args.rosetta:
        assert tag == "darwin-arm64", "Rosetta validation requires an arm64 Mac"
        tag = "darwin-x64"
    with tempfile.TemporaryDirectory(prefix="vetta-cpa-canary-") as directory:
        run(Path(directory), tag, args.rosetta)
