from rest_framework.viewsets import ViewSet
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate,get_user_model
from rest_framework.response import Response
import os
from .common import BaseClass
from accounts.models import CliToken
from accounts.serializer import CliTokenSerializer
import secrets
from django.utils import timezone
from datetime import timedelta
User = get_user_model()


class LoginUser(ViewSet):
    """
    
        Expected Request:
        POST /login/
        {
            "username": "username",
            "password": "password"
        }

        Response on Success:
        {
            "RES": true,
            "token": "<auth_token>",
        }

        Response on Failure:
        {
            "RES": false
        }
    """
    def list(self,reuqst):
        return Response({"Version":os.environ.get("VERSION","")})
    def create(self,request):
        print(request.data)
        try:

            username=request.data.get("username")
            password=request.data.get("password")
            if not username or not password:
                return Response({"RES": False,"msg": "Username and password are required."})
            
            user=authenticate(username=username,password=password)    
            if user and user.is_active:
                a=Token.objects.filter(user=user)
                for i in a:
                    i.delete()
                token=Token.objects.create(user=user)
                return Response({"RES":True,"token":token.key,"data":{"full_name":user.name}})
            return Response({"RES": False,"msg": "Invalid username or password."})

        except Exception as e:
            print("sdfdsf",e)
            return Response({"RES": False,"msg": "Invalid username or password"})
        


class Logout(BaseClass):
 
    def create(self,request):
        try:
            Token.objects.get(user=request.user).delete()
        except Token.DoesNotExist:
            pass  
        return Response({"RES":True})


class MyAccount(BaseClass):
 
    def list(self,request):
        user = request.user

        us = {
            "username": user.username,
            "email": user.email,
            "full_name": user.name,
        }
     
        return Response({"RES":True,"data":us})
    
    def create(self, request):
        user = request.user

        full_name = request.data.get("full_name")
        password = request.data.get("password")

        if full_name:
            user.name = full_name

        if password:
            user.set_password(password)

        user.save()
        return Response({"RES": True,"msg": "Profile updated successfully"})

    



class MyAccessToken(BaseClass):
    def list(self, request):
        tokens = CliToken.objects.filter(user=request.user).order_by("-created_at")
        if not tokens.exists():
            return Response({"RES": False,"msg": "Access token not found."})
        return Response({"RES": True,"data": CliTokenSerializer(tokens,many=True).data})



    def create(self, request):
        user = request.user

        name = request.data.get("name")
        description = request.data.get("description", "")
        days = request.data.get("days")

        if not name or not name.strip():
            return Response({"RES": False,"msg": "Token name is required.","data": None})

        expires_at = None

        if days not in [None, ""]:
            try:
                days = int(days)
                if days <= 0:
                    raise ValueError
            except (ValueError, TypeError):
                return Response({"RES": False,"msg": "Invalid expiry days.","data": None})

            expires_at = timezone.now() + timedelta(days=days)

        token = CliToken.objects.create(user=user,name=name.strip(),description=description,token=secrets.token_hex(32),expires_at=expires_at,is_active=True)

        return Response({
            "RES": True,
            "msg": "Access token created successfully.",
            "data": {
                "token": token.token,
                "name": token.name,
                "description": token.description,
                "created_at": token.created_at,
                "expires_at": token.expires_at,
                "is_active": token.is_active
            }
        })

    
class UpdateMyAccessToken(BaseClass):

    def create(self, request):
        id = request.data.get("id")

        if not id:
            return Response({"RES": False,"msg": "Token ID is required.","data": None})

        token = CliToken.objects.filter(id=id,user=request.user).first()

        if not token:
            return Response({"RES": False,"msg": "Access token not found.","data": None})

        name = request.data.get("name")
        description = request.data.get("description")
        is_active = request.data.get("is_active")

        if name is not None:
            if not isinstance(name, str) or not name.strip():
                return Response({"RES": False,"msg": "Name cannot be empty.","data": None})
            token.name = name.strip()

        if description is not None:
            token.description = description

        if is_active is not None:
            if not isinstance(is_active, bool):
                return Response({"RES": False,"msg": "is_active must be true or false.","data": None})
            token.is_active = is_active

        token.save()

        return Response({
            "RES": True,
            "msg": "Access token updated successfully.",
            "data": {
                "name": token.name,
                "description": token.description,
                "is_active": token.is_active,
                "updated_at": token.updated_at
            }
        })

class DeleteMyAccessToken(BaseClass):

    def create(self, request):
        id = request.data.get("id")

        if not id:
            return Response({"RES": False,"msg": "Token ID is required.","data": None})

        token = CliToken.objects.filter(id=id,user=request.user).first()

        if not token:
            return Response({"RES": False,"msg": "Access token not found.","data": None})
        token.delete()
        return Response({"RES": True,"msg": "Access token deleted successfully.","data": None})