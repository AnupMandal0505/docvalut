
import requests
import hashlib
import tarfile
import tempfile
import gzip
import shutil
import json
import subprocess

from pathlib import Path
from urllib.parse import quote

# Configuration
REGISTRY = "http://localhost:8000"
REPOSITORY = "psql"
TAG = "17"

IMAGE_NAME = f"{REPOSITORY}:{TAG}"



def download_blob(digest, destination):
    url = (
        f"{REGISTRY}/v2/{quote(REPOSITORY, safe='/')}"
        f"/blobs/{quote(digest, safe=':')}"
    )

    response = requests.get(url, stream=True, timeout=300)
    response.raise_for_status()

    hasher = hashlib.sha256()

    with open(destination, "wb") as file:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                hasher.update(chunk)
                file.write(chunk)

    actual_digest = "sha256:" + hasher.hexdigest()

    if actual_digest != digest:
        raise ValueError(f"Digest mismatch: expected {digest}, got {actual_digest}")


def main():

    print(f"Pulling {IMAGE_NAME} from {REGISTRY}")

    with tempfile.TemporaryDirectory() as temp:

        temp = Path(temp)
        image_dir = temp / "image"
        image_dir.mkdir()

        # 1. Download manifest
        manifest_url = (
            f"{REGISTRY}/v2/{quote(REPOSITORY, safe='/')}"
            f"/manifests/{quote(TAG, safe='')}"
        )

        response = requests.get(
            manifest_url,
            # headers={"Accept": MANIFEST_TYPE},
            timeout=30
        )
        response.raise_for_status()

        manifest = response.json()
        manifest=json.loads(manifest)
        # print(manifest)
        # return
        # 2. Download config
        config = manifest["config"]
        config_filename = config["digest"].split(":")[1] + ".json"
        config_path = image_dir / config_filename

        print("Downloading config...")
        download_blob(config["digest"], config_path)

        # Read the downloaded image config
        # with open(config_path, "r") as file:
        #     image_config = json.load(file)

        # print("\nConfig DiffIDs:")
        # for diff_id in image_config["rootfs"]["diff_ids"]:
        #     print(diff_id)

        # 3. Download and decompress layers
        layer_paths = []

        for index, layer in enumerate(manifest["layers"]):

            layer_dir = image_dir / f"layer-{index}"
            layer_dir.mkdir()

            # compressed_path = layer_dir / "layer.tar.gz"
            uncompressed_path = layer_dir / "layer.tar"

            print(f"Downloading layer {index + 1}/{len(manifest['layers'])}...")

            download_blob(layer["digest"], uncompressed_path)
 
            # Docker save archive expects uncompressed layer.tar
            # with open(compressed_path, "rb") as source:
            #     print("Source:", source.name)
            #     print("First bytes:", source.read(16).hex())
            #     source.seek(0)
            #     with open(uncompressed_path, "wb") as destination:
            #         print("Destination:", destination.name)
            #         shutil.copyfileobj(source, destination)

            # compressed_path.unlink()

            layer_paths.append(
                f"layer-{index}/layer.tar"
            )

        # 4. Create Docker save manifest.json
        docker_manifest = [{
            "Config": config_filename,
            "RepoTags": [IMAGE_NAME],
            "Layers": layer_paths
        }]

        manifest_path = image_dir / "manifest.json"

        with open(manifest_path, "w") as file:
            json.dump(docker_manifest, file)

        # 5. Assemble Docker archive
        archive_path = temp / "image.tar"

        with tarfile.open(archive_path, "w") as archive:

            archive.add(manifest_path, arcname="manifest.json")
            archive.add(
                image_dir / config_filename,
                arcname=config_filename
            )

            for layer_path in layer_paths:
                archive.add(
                    image_dir / layer_path,
                    arcname=layer_path
                )

        # 6. Import into Docker
        print("Loading image into Docker...")

        subprocess.run(
            ["docker", "load", "-i", str(archive_path)],
            check=True
        )

        print(f"\nSuccessfully pulled: {IMAGE_NAME}")


if __name__ == "__main__":
    main()
