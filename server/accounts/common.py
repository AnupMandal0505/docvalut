from adrf.viewsets import ViewSet
from rest_framework.authentication import TokenAuthentication,SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from accounts.models import CliToken
from django.utils import timezone
from rest_framework.views import APIView


class BaseClass(ViewSet):
    authentication_classes=[TokenAuthentication,SessionAuthentication]
    permission_classes=[IsAuthenticated]

class CliTokenAuthentication(BaseAuthentication):

    def authenticate(self, request):

        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            raise AuthenticationFailed("CLI token is required.")

        token = auth_header.split(" ", 1)[1].strip()
        # TODO: add cache here
        cli_token = CliToken.objects.filter(
            token=token,
            is_active=True
        ).first()

        if not cli_token:
            raise AuthenticationFailed("Invalid token.")

        if cli_token.expires_at and cli_token.expires_at <= timezone.now():
            cli_token.delete()#ToDO: Test this
            raise AuthenticationFailed("Token has expired.")

        return (cli_token.user, cli_token)


class BaseCliView(APIView):
    authentication_classes = [CliTokenAuthentication]