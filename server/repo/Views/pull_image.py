from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import Http404,FileResponse,HttpResponse
from django.shortcuts import get_object_or_404
from repo import models
import os
from accounts.common import CliTokenAuthentication



class ManifestDownloadView(APIView):
    authentication_classes = [CliTokenAuthentication]

    def get(self, request):
        repository=request.GET.get("repository")
        reference=request.GET.get("reference")
        repo=models.Repository.objects.get(name=repository)
        if reference.startswith("sha256:"):
            manifest = models.Manifest.objects.get(digest=reference)
        else:
            print("the tag is ",reference)
            tag = models.Tag.objects.get(repository=repo,name=reference)
            manifest = tag.manifest

        print("here is the data")
        response = HttpResponse(
            manifest.content,
            content_type=manifest.media_type,
            status=status.HTTP_200_OK
        )

        response["Docker-Content-Digest"] = manifest.digest

        return response


class BlobDownloadView(APIView):
    authentication_classes = [CliTokenAuthentication]

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

    def get(self, request):
        repository=request.GET.get("repository")
        digest=request.GET.get("digest")
        blob = self.get_blob(repository, digest)

        response = FileResponse(
            open(blob.storage_path, "rb"),
            content_type="application/octet-stream"
        )

        response["Content-Length"] = str(blob.size)
        response["Docker-Content-Digest"] = blob.digest

        return response

    def head(self, request):
        repository=request.GET.get("repository")
        digest=request.GET.get("digest")
        blob = self.get_blob(repository, digest)

        response = HttpResponse(status=200)
        response["Content-Type"] = "application/octet-stream"
        response["Content-Length"] = str(blob.size)
        response["Docker-Content-Digest"] = blob.digest

        return response


class TagListView(APIView):
    authentication_classes = [CliTokenAuthentication]

    def get(self, request):
        repository=request.GET.get("repository")
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