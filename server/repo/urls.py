app_name="hub"
from django.urls import path
from .Views.push_image import *
from .Views import pull_image

urlpatterns = [
    path("push/<path:repository>/blobs/uploads/",BlobUploadViewSet.as_view(),name="blob-upload"),
    path("push/<path:repository>/blobs/uploads/<str:upload_uuid>",BlobUploadViewSet.as_view(),name="blob-upload-patch"),
    path("push/<path:repository>/blobs/<str:digest>",Check_Blob.as_view(),name="check-blob",),
    path("push/<path:repository>/manifests/<str:reference>",ManifestUploadViewSet.as_view(),name="manifest-upload"),
    # pull#
    path("pull/<path:repository>/manifests/<str:reference>",pull_image.ManifestDownloadView.as_view()),
    path("pull/<path:repository>/blobs/<str:digest>",pull_image.BlobDownloadView.as_view()),
    path("pull/<path:repository>/tags/list",pull_image.TagListView.as_view()),
]