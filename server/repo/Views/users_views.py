from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.response import Response
from repo.models import *


class RepositoryViewSet(viewsets.ViewSet):

    def list(self, request):
        repos = Repository.objects.values("id", "name", "description", "icon", "created_at")
        return Response({"count": repos.count(), "results": list(repos)})

    def retrieve(self, request):
        repo = get_object_or_404(Repository.objects.values("id", "name", "description", "icon", "created_at"), name=request.GET.get("name"))
        return Response(repo)

    def create(self, request):
        repo = Repository.objects.create(
            name=request.data.get("name"),
            description=request.data.get("description", ""),
            icon=request.FILES.get("icon"),
        )
        return Response({"id": repo.id, "name": repo.name}, status=201)

    def update(self, request):
        repo = get_object_or_404(Repository, name=request.data.get("name"))
        repo.description = request.data.get("description", repo.description)
        if "icon" in request.FILES:
            repo.icon = request.FILES["icon"]
        repo.save()
        return Response({"id": repo.id, "name": repo.name})

    def destroy(self, request, name=None):
        get_object_or_404(Repository, name=name).delete()
        return Response(status=204)