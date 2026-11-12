#!/usr/bin/env python3
"""
Minimal Docker Registry V2 push prototype.

Usage:
  pip install requests
  python push_image.py mongo:latest http://localhost:8000 team-a/mongo:latest

Assumptions:
- Docker is installed and the image is available locally.
- The target implements the Registry V2 blob upload and manifest endpoints.
- The registry accepts Docker schema-2 manifests and basic/no authentication.
- `docker save` layer.tar entries are uncompressed tar streams. This script
  gzip-compresses them and uses the digest/size of those exact gzip bytes.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode, urljoin, urlsplit, urlunsplit

import requests


MANIFEST_MEDIA_TYPE = "application/vnd.docker.distribution.manifest.v2+json"
CONFIG_MEDIA_TYPE = "application/vnd.docker.container.image.v1+json"
LAYER_MEDIA_TYPE = "application/vnd.docker.image.rootfs.diff.tar.gzip"


def sha256_digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def resolve_location(previous_url: str, location: str | None) -> str:
    return urljoin(previous_url, location) if location else previous_url


def with_digest_query(url: str, digest: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["digest"] = digest
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


class RegistryPusher:
    def __init__(self, registry: str, username: str | None = None,
                 password: str | None = None, insecure: bool = False):
        self.registry = registry.rstrip("/")
        self.session = requests.Session()
        if username is not None:
            self.session.auth = (username, password or "")
        self.verify_tls = not insecure

    def api_url(self, path: str) -> str:
        return f"{self.registry}/v2/{path.lstrip('/')}"

    def check_api(self) -> None:
        response = self.session.get(
            self.api_url(""), timeout=30, verify=self.verify_tls
        )
        response.raise_for_status()
        print("Registry API: reachable")

    def blob_exists(self, repository: str, digest: str) -> bool:
        url = self.api_url(
            f"{quote(repository, safe='/')}/blobs/{quote(digest, safe=':')}"
        )
        response = self.session.head(url, timeout=30, verify=self.verify_tls)
        if response.status_code == 404:
            return False
        response.raise_for_status()
        return True

    def upload_blob(self, repository: str, path: Path, digest: str) -> None:
        if self.blob_exists(repository, digest):
            print(f"  exists: {digest}")
            return

        start_url = self.api_url(
            f"{quote(repository, safe='/')}/blobs/uploads/"
        )
        response = self.session.post(
            start_url, timeout=30, verify=self.verify_tls
        )
        response.raise_for_status()
        if response.status_code != 202:
            raise RuntimeError(f"Expected 202 from upload start, got {response.status_code}")

        upload_url = resolve_location(start_url, response.headers.get("Location"))

        with path.open("rb") as blob_file:
            response = self.session.patch(
                upload_url,
                data=blob_file,
                headers={"Content-Type": "application/octet-stream"},
                timeout=(30, 900),
                verify=self.verify_tls,
            )
        response.raise_for_status()
        upload_url = resolve_location(upload_url, response.headers.get("Location"))

        finalize_url = with_digest_query(upload_url, digest)
        response = self.session.put(
            finalize_url,
            data=b"",
            headers={"Content-Length": "0"},
            timeout=120,
            verify=self.verify_tls,
        )
        response.raise_for_status()
        print(f"  uploaded: {digest} ({path.stat().st_size} bytes)")

    def upload_manifest(self, repository: str, reference: str, manifest: bytes) -> None:
        url = self.api_url(
            f"{quote(repository, safe='/')}/manifests/{quote(reference, safe='')}"
        )
        response = self.session.put(
            url,
            data=manifest,
            headers={
                "Content-Type": MANIFEST_MEDIA_TYPE,
                "Accept": "*/*",
            },
            timeout=120,
            verify=self.verify_tls,
        )
        response.raise_for_status()
        print(f"Manifest pushed: {repository}:{reference}")
        print("Manifest digest:", response.headers.get("Docker-Content-Digest", "(not returned)"))


def parse_target(target: str) -> tuple[str, str]:
    # Target is a repository:tag, e.g. team-a/mongo:latest.
    try:
        last_slash = target.rfind("/")
        colon = target.rfind(":")
        if colon > last_slash:
            return target[:colon], target[colon + 1:]
        return target, "latest"
    except:
        print("hat bara")
        raise ValueError()
    # target:list=target.split(":")
    # if len(target) >=2:
    #     tag=target.pop()
    #     return ("".join(target) ,tag)


def export_image(image: str, archive_path: Path) -> None:
    print(f"Exporting local image {image} ...")
    subprocess.run(
        ["docker", "image", "save", "--output", str(archive_path), image],
        check=True,
    )


def prepare_blobs(archive_path: Path, work_dir: Path, requested_image: str):
    """
    Read Docker's save archive without unpacking arbitrary archive paths.
    Returns (config_path, config_digest, config_size, layer descriptors).
    """
    with tarfile.open(archive_path, mode="r:*") as archive:
        manifest_member = archive.extractfile("manifest.json")
        if manifest_member is None:
            raise RuntimeError("docker save archive has no manifest.json")

        entries = json.load(manifest_member)
        if not entries:
            raise RuntimeError("manifest.json contains no image entries")

        requested_tag = requested_image
        selected = next(
            (entry for entry in entries if requested_tag in entry.get("RepoTags", [])),
            None,
        )
        if selected is None:
            # `docker save` can normalize names; if only one image entry exists,
            # use it rather than guessing among multiple entries.
            if len(entries) == 1:
                selected = entries[0]
            else:
                available = [tag for entry in entries for tag in entry.get("RepoTags", [])]
                raise RuntimeError(
                    f"Could not match {requested_image!r} in archive. Found tags: {available}"
                )

        config_name = selected["Config"]
        config_member = archive.extractfile(config_name)
        if config_member is None:
            raise RuntimeError(f"Missing config file in archive: {config_name}")
        config_bytes = config_member.read()

        config_path = work_dir / "config.json"
        config_path.write_bytes(config_bytes)
        config_digest = sha256_digest(config_bytes)

        layer_descriptors = []
        for index, layer_name in enumerate(selected["Layers"]):
            layer_member = archive.extractfile(layer_name)
            if layer_member is None:
                raise RuntimeError(f"Missing layer in archive: {layer_name}")

            compressed_path = work_dir / f"layer-{index}.tar.gz"
            # The docker-save layer.tar stream is the uncompressed layer tar.
            # The registry descriptor digest is over the gzip-compressed bytes.
            with compressed_path.open("wb") as output:
                with gzip.GzipFile(
                    filename="", mode="wb", fileobj=output, mtime=0
                ) as gz:
                    shutil.copyfileobj(layer_member, gz, length=1024 * 1024)

            layer_descriptors.append({
                "mediaType": LAYER_MEDIA_TYPE,
                "size": compressed_path.stat().st_size,
                "digest": sha256_file(compressed_path),
                "path": compressed_path,
            })

    return config_path, config_digest, config_path.stat().st_size, layer_descriptors


def main() -> None:
    parser = argparse.ArgumentParser(description="Push a local Docker image to a Registry V2 endpoint.")
    parser.add_argument("image", help="Local image, e.g. mongo:latest")
    parser.add_argument("registry", help="Registry origin, e.g. http://localhost:8000 (no /v2)",default="http://localhost:8000")
    # parser.add_argument("target", help="Remote repository:tag, e.g. team-a/mongo:latest")
    parser.add_argument("--username")
    parser.add_argument("--password")
    parser.add_argument("--insecure", action="store_true", help="Disable TLS certificate verification")
    args = parser.parse_args()

    repository, reference = parse_target(args.image)
    # print(repository,"   ",reference)
    # return

    if not repository or not reference:
        parser.error("target must be in repository:tag form")

    with tempfile.TemporaryDirectory(prefix="registry-push-") as temp:
        work_dir = Path(temp)
        archive_path = work_dir / "image.tar"

        export_image(args.image, archive_path)
        config_path, config_digest, config_size, layers = prepare_blobs(
            archive_path, work_dir, args.image
        )

        pusher = RegistryPusher(
            args.registry, args.username, args.password, args.insecure
        )
        pusher.check_api()

        print("Uploading config ...")
        pusher.upload_blob(repository, config_path, config_digest)

        print("Uploading layers ...")
        for layer in layers:
            pusher.upload_blob(repository, layer["path"], layer["digest"])

        manifest = {
            "schemaVersion": 2,
            "mediaType": MANIFEST_MEDIA_TYPE,
            "config": {
                "mediaType": CONFIG_MEDIA_TYPE,
                "size": config_size,
                "digest": config_digest,
            },
            "layers": [
                {
                    "mediaType": layer["mediaType"],
                    "size": layer["size"],
                    "digest": layer["digest"],
                }
                for layer in layers
            ],
        }
        manifest_bytes = json.dumps(
            manifest, separators=(",", ":"), ensure_ascii=False
        ).encode("utf-8")

        print("Uploading manifest ...")
        pusher.upload_manifest(repository, reference, manifest_bytes)


if __name__ == "__main__":
    main()
