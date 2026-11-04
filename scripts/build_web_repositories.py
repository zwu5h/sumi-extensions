"""Build standalone website adapters and a root index including all source providers."""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://raw.githubusercontent.com/zwu5h/sumi-extensions/main"
PROVIDERS = [
    ("mangakatana", "MangaKatana · English", ["mangakatana.com", "*.mangakatana.com"], "https://mangakatana.com/"),
]


def generated_files():
    common = (ROOT / "extensions/web-common.js").read_text(encoding="utf-8")
    files = {}
    for provider, name, hosts, website in PROVIDERS:
        adapter = (ROOT / f"extensions/{provider}/adapter.js").read_text(encoding="utf-8")
        code = (common + "\n" + adapter).encode("utf-8")
        digest = hashlib.sha256(code).hexdigest()
        path = f"extensions/{provider}/dist/{provider}-en-{digest[:16]}.js"
        files[path] = code
        manifest = {"schemaVersion": 1, "name": name, "extensions": [{
            "id": f"org.zwu5h.{provider}.en", "name": name, "version": "1.0.0", "apiVersion": 1,
            "script": f"{BASE}/{path}", "sha256": digest, "hosts": hosts,
            "website": website, "author": "zwu5h · unofficial adapter",
        }]}
        files[f"extensions/{provider}/repository.json"] = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return files


def aggregate():
    items = []
    for path in sorted((ROOT / "extensions").glob("*/repository.json")):
        items.extend(json.loads(path.read_text(encoding="utf-8"))["extensions"])
    if len(items) != len({item["id"] for item in items}):
        raise ValueError("Duplicate source IDs")
    return (json.dumps({"schemaVersion": 1, "name": "Sumi sources", "extensions": items}, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def build(check=False):
    for name, content in generated_files().items():
        path = ROOT / name
        if check:
            if not path.exists() or path.read_bytes() != content:
                raise ValueError(f"Regenerate {name}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
    root_index = ROOT / "repository.json"
    content = aggregate()
    if check:
        if not root_index.exists() or root_index.read_bytes() != content:
            raise ValueError("Regenerate root repository.json")
    else:
        root_index.write_bytes(content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    build(parser.parse_args().check)
    print("Website source repositories verified")
