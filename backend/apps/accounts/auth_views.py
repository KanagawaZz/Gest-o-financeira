from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.audit.services import record

from .exports import export_user_data


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    first_name = serializers.CharField()
    email = serializers.EmailField()


class ProfileSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)


class PasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Define o cookie CSRF para o SPA."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = authenticate(request, **data.validated_data)
        if user is None or not user.is_active:
            # Mensagem única: não revela se o usuário existe.
            return Response(
                {"error": {"code": "invalid_credentials", "message": "Usuário ou senha incorretos.", "details": None}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        data = ProfileSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        for field, value in data.validated_data.items():
            setattr(request.user, field, value)
        request.user.save(update_fields=list(data.validated_data))
        return Response(UserSerializer(request.user).data)


class PasswordView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password"

    def post(self, request):
        data = PasswordSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(data.validated_data["current_password"]):
            raise serializers.ValidationError({"current_password": ["Senha atual incorreta."]})
        try:
            validate_password(data.validated_data["new_password"], user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"new_password": list(e.messages)}) from e
        user.set_password(data.validated_data["new_password"])
        user.save(update_fields=["password"])
        update_session_auth_hash(request, user)  # mantém esta sessão; invalida as demais
        record(user, "auth.password_changed", model="User", object_id=user.pk)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExportView(APIView):
    """Baixa todos os dados do usuário em JSON."""

    def get(self, request):
        resp = HttpResponse(export_user_data(request.user), content_type="application/json; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="nexo-dados-{timezone.localdate()}.json"'
        resp["Cache-Control"] = "no-store"
        return resp
