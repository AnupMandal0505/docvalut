from rest_framework import serializers
from accounts.models import CliToken


class CliTokenSerializer(serializers.ModelSerializer):

    class Meta:
        model = CliToken
        fields =(
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "expires_at",
            "is_active"
        )
        read_only_fields =(
            "created_at",
            "updated_at",
            "expires_at"
        )