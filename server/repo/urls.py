from django.urls import path
from .Views.push_image import *
from .Views import pull_image

urlpatterns = [
    # path("v2/", ApiVersionn, name="registry-api"),
    # path("v2/<path:repository>/blobs/uploads/",BlobUploadViewSet.as_view(),name="blob-upload"),
    # path("v2/<path:repository>/blobs/uploads/<str:upload_uuid>",BlobUploadViewSet.as_view(),name="blob-upload-patch"),
    # path("v2/<path:repository>/blobs/<str:digest>",Check_Blob.as_view(),name="check-blob",),
    # path("v2/<path:repository>/manifests/<str:reference>",ManifestUploadViewSet.as_view(),name="manifest-upload"),
    # pull#
    path("v2/<path:repository>/manifests/<str:reference>",pull_image.ManifestDownloadView.as_view()),
    path("v2/<path:repository>/blobs/<str:digest>",pull_image.BlobDownloadView.as_view()),
    path("v2/<path:repository>/tags/list",pull_image.TagListView.as_view()),
]