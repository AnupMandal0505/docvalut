"""
create.py – Create ViewSets for the Docker/OCI registry management API.

All ViewSets extend BaseClass (TokenAuthentication + IsAuthenticated).
Only create operations are defined here.
Read operations live in views.py.

URL prefix: /logic/master/create/<basename>/
"""

from asgiref.sync import sync_to_async
from rest_framework.response import Response
from accounts.common import BaseClass
from repo.models import (Repository,)
from .serializer import (RepositorySerializer)


# ---------------------------------------------------------------------------
# Repository – Create
# ---------------------------------------------------------------------------

class MyRepository(BaseClass):
    """
    POST /logic/master/create/my-repository/
    """

    async def create(self, request):
        name = request.data.get("name")
        description = request.data.get("description", "")
        icon = request.FILES.get("icon")

        if not name or not name.strip():
            return Response({"RES": False, "msg": "Repository name must not be empty.", "data": ""})

        name = name.strip()
        name = f"{request.user.username}/{name.strip()}"

        if await Repository.objects.filter(name=name).aexists():
            return Response({"RES": False, "msg": f"A repository named '{name}' already exists.", "data": ""})

        repo = await Repository.objects.acreate(name=name, description=description, icon=icon)
        serializer = RepositorySerializer(repo)
        data = await sync_to_async(lambda: serializer.data)()
        return Response({"RES": True, "msg": "Repository created.", "data": data})

class DeleteMyRepository(BaseClass):
    """
    POST /logic/master/create/delete-my-repository/
    """

    async def create(self, request):
        print(request.data)
        return Response({"RES": True, "msg": "Deleted Repository."})