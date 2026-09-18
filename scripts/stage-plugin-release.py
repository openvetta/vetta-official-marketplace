"""Build one installable plugin ZIP outside the marketplace source tree.

The script prints the release record to copy into schema v3. It never edits the
catalog or uploads a release asset. Run it after the plugin's build and tests.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
RUNTIME_FILES = {"plugin.json", "package.json", "README.md", "LICENSE", "runtime-lock.json", "upstream.json"}
RUNTIME_DIRS = {"dist", "locales", "agent", "assets", "service"}
SKIP_DIRS = {"node_modules", "src", "test", "tests", "release", ".git", ".vite"}
MAX_BYTES = 50 * 1024 * 1024


def plugin_entry(catalog: dict, slug: str) -> dict:
    for ability in catalog["abilities"]:
        if ability["type"] == "plugin" and ability["slug"] == slug:
            return ability
        if ability["type"] == "bundle":
            for member in ability["config"]["members"]:
                if member["type"] == "plugin" and member["slug"] == slug and "source" in member:
                    return member
    raise ValueError(f"Plugin {slug} is not listed in the marketplace")


def regular_files(directory: Path) -> list[Path]:
    result = []
    for name in sorted(RUNTIME_FILES):
        path = directory / name
        if path.exists():
            result.append(path)
    for name in sorted(RUNTIME_DIRS):
        parent = directory / name
        if not parent.exists():
            continue
        if parent.is_symlink():
            raise ValueError(f"Plugin contains a symlink: {parent}")
        for current, dirs, files in os.walk(parent, followlinks=False):
            for dirname in dirs:
                if (Path(current) / dirname).is_symlink():
                    raise ValueError(f"Plugin contains a symlink: {Path(current) / dirname}")
            dirs[:] = sorted(name for name in dirs if name not in SKIP_DIRS)
            for filename in sorted(files):
                result.append(Path(current) / filename)
    for path in result:
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Plugin contains a symlink or unsupported file: {path}")
    return sorted(result, key=lambda path: path.relative_to(directory).as_posix())


def build(slug: str, output_dir: Path, min_app_version: str) -> dict:
    if not __import__("re").fullmatch(r"\d+\.\d+\.\d+", min_app_version):
        raise ValueError("--min-app-version must be a stable x.y.z version")
    catalog = json.loads((ROOT / ".vetta/marketplace.json").read_text(encoding="utf-8"))
    entry = plugin_entry(catalog, slug)
    directory = (ROOT / entry["source"]["path"]).resolve()
    if not directory.is_relative_to(ROOT.resolve()) or not directory.is_dir():
        raise ValueError(f"Unsafe or missing plugin directory: {slug}")
    plugin = json.loads((directory / "plugin.json").read_text(encoding="utf-8"))
    if plugin["id"] != slug or ("version" in entry and entry["version"] != plugin["version"]):
        raise ValueError(f"Plugin identity differs from catalog: {slug}")
    files = regular_files(directory)
    paths = {path.relative_to(directory).as_posix() for path in files}
    for required in ["plugin.json", plugin["entry"], *plugin.get("styles", [])]:
        if required not in paths:
            raise ValueError(f"Missing packaged plugin file: {slug}/{required}")
    filename = f"{slug}-{plugin['version']}.zip"
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / filename
    try:
        with zipfile.ZipFile(target, "w") as archive:
            for path in files:
                relative = path.relative_to(directory).as_posix()
                info = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                archive.writestr(info, path.read_bytes(), compresslevel=9)
        data = target.read_bytes()
        if len(data) > MAX_BYTES:
            raise ValueError(f"Plugin ZIP exceeds the 50 MB Desktop limit: {slug}")
    except BaseException:
        target.unlink(missing_ok=True)
        raise
    repository = catalog["repository"].rstrip("/")
    release = {
        "version": plugin["version"],
        "minAppVersion": min_app_version,
        "pluginApiVersion": plugin["pluginApiVersion"],
        "permissions": plugin.get("permissions", []),
        "commands": plugin.get("commands", []),
        "artifact": {
            "url": f"{repository}/releases/download/plugin-{slug}-{plugin['version']}/{filename}",
            "sha256": hashlib.sha256(data).hexdigest(),
        },
    }
    (output_dir / f"{slug}-{plugin['version']}.json").write_text(
        json.dumps(release, indent=2) + "\n", encoding="utf-8"
    )
    return release


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slug")
    parser.add_argument("--min-app-version", required=True)
    parser.add_argument("--output-dir", type=Path, default=ROOT / ".release-artifacts")
    args = parser.parse_args()
    try:
        print(json.dumps(build(args.slug, args.output_dir, args.min_app_version), indent=2))
    except (KeyError, OSError, ValueError, zipfile.BadZipFile) as error:
        print(f"[plugin-release] {error}", file=sys.stderr)
        sys.exit(1)
