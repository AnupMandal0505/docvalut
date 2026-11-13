"""
ui/views.py — render-only views.

Every view here does exactly one thing: return the HTML shell for a page.
No queryset, no context data. The page's JS fetches everything from the
DRF API (api app). URL kwargs (repo name, tag, digest) are accepted but
ignored — the JS reads them from location.pathname.

Keep the class names stable: urls.py and the sidebar's {% url 'ui:...' %}
tags depend on the route names below, not on these classes, but it is
easier to reason about one class per page.
"""
from django.conf import settings
from django.views.generic import TemplateView


class PageView(TemplateView):
    """
    Base for all UI pages.

    - Adds `Cache-Control: no-store` so a logged-out browser can't show a
      cached shell (the shell is harmless, but it avoids confusion).
    - Exposes a couple of *static* config values to the template. These are
      deployment constants, not data, so they are allowed in the template:
      the HTML uses them only to set <script> globals that api.js reads.
    """
    page_name = ""          # used by the template for <title> fallback / data-page attr
    requires_auth = True    # login page sets this to False

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["page_name"] = self.page_name
        ctx["api_base"] = getattr(settings, "REGISTRY_UI_API_BASE", "/api/v1")
        ctx["use_mock"] = getattr(settings, "REGISTRY_UI_MOCK", settings.DEBUG)
        return ctx

    def dispatch(self, request, *args, **kwargs):
        response = super().dispatch(request, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


# ---- Auth -------------------------------------------------------------------

class LoginPage(PageView):
    template_name = "pages/login.html"
    page_name = "login"
    requires_auth = False


# ---- Overview ---------------------------------------------------------------

class DashboardPage(PageView):
    template_name = "pages/dashboard.html"
    page_name = "dashboard"


# ---- Content ----------------------------------------------------------------

class RepositoriesPage(PageView):
    template_name = "pages/repositories.html"
    page_name = "repositories"


class RepositoryPage(PageView):
    """/r/<name>/ — <name> may contain '/' (namespaces)."""
    template_name = "pages/repository.html"
    page_name = "repository"


class ManifestPage(PageView):
    """
    /r/<name>/tags/<tag>/       and
    /r/<name>/manifests/<digest>/
    Both render the same template; JS decides whether it was reached by
    tag or by digest.
    """
    template_name = "pages/manifest.html"
    page_name = "manifest"


class BlobsPage(PageView):
    template_name = "pages/blobs.html"
    page_name = "blobs"


# ---- Operations -------------------------------------------------------------

class UploadsPage(PageView):
    template_name = "pages/uploads.html"
    page_name = "uploads"


class GarbageCollectionPage(PageView):
    template_name = "pages/gc.html"
    page_name = "gc"


# ---- Admin ------------------------------------------------------------------

class SettingsPage(PageView):
    template_name = "pages/settings.html"
    page_name = "settings"
