
app_name="logic"
from django.urls import path,include
from logic.master import urls as master_urls

urlpatterns = [
   path('master/',include(master_urls),name="master"),#logic/master/
]
