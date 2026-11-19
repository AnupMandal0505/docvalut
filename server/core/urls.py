from django.contrib import admin
from django.urls import path, include


urlpatterns = [
    path('admin/', admin.site.urls),
    path("v1/", include("repo.urls")),
    path('auth/',include('accounts.urls',namespace='account')),
    path('logic/',include('logic.urls',namespace='logic')),

]

   