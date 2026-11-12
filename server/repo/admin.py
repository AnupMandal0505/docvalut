
from django.contrib import admin
from .models import (
    Repository,
    UploadSession,
    Blob,
    Manifest,
    RepositoryManifest,
    Tag,
)


@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(UploadSession)
class UploadSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "repo",
        "offset",
        "status",
        "created_at",
        "updated_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("id", "repo__name")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Blob)
class BlobAdmin(admin.ModelAdmin):
    list_display = ("digest", "size", "created_at")
    search_fields = ("digest",)
    readonly_fields = ("digest", "size", "storage_path", "created_at")


@admin.register(Manifest)
class ManifestAdmin(admin.ModelAdmin):
    list_display = ("digest", "media_type", "created_at")
    search_fields = ("digest", "media_type")
    readonly_fields = ("digest", "media_type", "content", "created_at")


@admin.register(RepositoryManifest)
class RepositoryManifestAdmin(admin.ModelAdmin):
    list_display = ("repository", "manifest")
    search_fields = ("repository__name", "manifest__digest")


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "repository", "manifest", "updated_at")
    list_filter = ("repository", "updated_at")
    search_fields = ("name", "repository__name", "manifest__digest")
    readonly_fields = ("updated_at",)
