app_name = "ui"
from django.urls import path, re_path
from .Views.html_render import * 


REPO = r"(?P<name>[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*)"
TAG = r"(?P<tag>[\w][\w.-]{0,127})"
DIGEST = r"(?P<digest>sha256:[a-f0-9]{64})"

urlpatterns = [
    # auth
    path("login/", LoginPage.as_view(), name="login"),

    # overview
    path("", DashboardPage.as_view(), name="dashboard"),

    # content
    path("repositories/", RepositoriesPage.as_view(), name="repositories"),
    path("blobs/", BlobsPage.as_view(), name="blobs"),

    # operations
    path("uploads/", UploadsPage.as_view(), name="uploads"),
    path("gc/", GarbageCollectionPage.as_view(), name="gc"),

    # admin
    path("settings/", SettingsPage.as_view(), name="settings"),

    # repository detail — most specific first
    re_path(rf"^r/{REPO}/tags/{TAG}/$", ManifestPage.as_view(), name="tag"),
    re_path(rf"^r/{REPO}/manifests/{DIGEST}/$", ManifestPage.as_view(), name="manifest"),
    re_path(rf"^r/{REPO}/$", RepositoryPage.as_view(), name="repository"),
]
