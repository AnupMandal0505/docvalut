from django.db import models
import uuid
from django.contrib.auth.models import (AbstractBaseUser,PermissionsMixin)
from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True,default=uuid.uuid7,editable=False)
    email = models.EmailField(unique=True,db_index=True)
    name = models.CharField(max_length=150,blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    class Meta:
        db_table = "users"
    def __str__(self):
        return self.email


class CliToken(models.Model):
    token=models.CharField(max_length=100,unique=True,primary_key=True)
    user=models.ForeignKey(User,on_delete=models.CASCADE)
    created_at= models.DateTimeField(auto_now_add=True)
    expires_at=models.DateTimeField(null=True,blank=True)