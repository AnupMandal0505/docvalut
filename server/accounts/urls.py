app_name="account"
from django.urls import path,include
from rest_framework.routers import SimpleRouter
from .views import *

router=SimpleRouter()#/auth/del-my-token
router.register("login",LoginUser,basename="login")
router.register("logout",Logout,basename="logout")
router.register("my-profile",MyAccount,basename="my-profile")
router.register("my-token",MyAccessToken,basename="my-token")
router.register("del-my-token",DeleteMyAccessToken,basename="del-my-token")
router.register("update-my-token",UpdateMyAccessToken,basename="update-my-token")

urlpatterns = [
   path("",include(router.urls),name="authurls"),
]