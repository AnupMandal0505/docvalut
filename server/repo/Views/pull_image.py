from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import Http404,FileResponse,HttpResponse
from django.shortcuts import get_object_or_404
from repo import models
import os

class ManifestDownloadView(APIView):
    def get(self, request, repository, reference):
        repo = get_object_or_404(models.Repository,name=repository)
        if reference.startswith("sha256:"):
            manifest = get_object_or_404(
                models.Manifest,
                digest=reference
            )
        else:
            tag = get_object_or_404(
                models.Tag,
                repository=repo,
                name=reference
            )
            manifest = tag.manifest

        response = Response(
            manifest.content,
            content_type=manifest.media_type,
            status=status.HTTP_200_OK
        )

        response["Docker-Content-Digest"] = manifest.digest

        return response


class BlobDownloadView(APIView):

    def get_blob(self, repository, digest):
        repo = get_object_or_404(
            models.Repository,
            name=repository
        )

        # Prototype: blobs are globally deduplicated by digest.
        blob = get_object_or_404(
            models.Blob,
            digest=digest
        )

        if not os.path.isfile(blob.storage_path):
            raise Http404("Blob file not found")

        return blob

    def get(self, request, repository, digest):
        blob = self.get_blob(repository, digest)

        response = FileResponse(
            open(blob.storage_path, "rb"),
            content_type="application/octet-stream"
        )

        response["Content-Length"] = str(blob.size)
        response["Docker-Content-Digest"] = blob.digest

        return response

    def head(self, request, repository, digest):
        blob = self.get_blob(repository, digest)

        response = HttpResponse(status=200)
        response["Content-Type"] = "application/octet-stream"
        response["Content-Length"] = str(blob.size)
        response["Docker-Content-Digest"] = blob.digest

        return response


class TagListView(APIView):

    def get(self, request, repository):
        repo = get_object_or_404(
            models.Repository,
            name=repository
        )

        tags = models.Tag.objects.filter(
            repository=repo
        ).order_by("name").values_list(
            "name",
            flat=True
        )

        return Response({
            "name": repo.name,
            "tags": list(tags)
        }, status=status.HTTP_200_OK)