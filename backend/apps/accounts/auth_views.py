from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
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


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value: str) -> str:
        User = get_user_model()
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Informe um nome de usuário.")
        if User.objects.filter(username__iexact=cleaned).exists():
            raise serializers.ValidationError("Este nome de usuário já está em uso.")
        return cleaned

    def validate_email(self, value: str) -> str:
        User = get_user_model()
        cleaned = value.strip().lower()
        if cleaned and User.objects.filter(email__iexact=cleaned).exists():
            raise serializers.ValidationError("Este e-mail já está em uso por outra conta.")
        return cleaned

    def validate_password(self, value: str) -> str:
        User = get_user_model()
        temp_user = User(
            username=self.initial_data.get("username", ""),
            email=self.initial_data.get("email", ""),
            first_name=self.initial_data.get("first_name", ""),
        )
        try:
            validate_password(value, temp_user)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages)) from e
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)


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


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def get(self, request):
        """Informa se o cadastro de novos usuários está habilitado."""
        return Response({"enabled": getattr(settings, "REGISTRATION_ENABLED", True)})

    def post(self, request):
        if not getattr(settings, "REGISTRATION_ENABLED", True):
            return Response(
                {
                    "error": {
                        "code": "registration_disabled",
                        "message": "Novos cadastros estão temporariamente suspensos.",
                        "details": None,
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        data = RegisterSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        valid = data.validated_data

        from django.contrib.auth import get_user_model
        from apps.categories.services import seed_default_categories

        User = get_user_model()
        user = User.objects.create_user(
            username=valid["username"],
            email=valid.get("email", ""),
            first_name=valid.get("first_name", ""),
            password=valid["password"],
        )

        seed_default_categories(user)
        record(user, "auth.registered", model="User", object_id=user.pk)
        login(request, user)

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


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


class PasswordResetRequestView(APIView):
    """Solicita redefinição de senha por e-mail."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        User = get_user_model()
        users = User.objects.filter(email__iexact=email, is_active=True)
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")

        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{frontend_url}/redefinir-senha?uid={uid}&token={token}"
            subject = "NEXO — Redefinição de senha"
            message = (
                f"Olá, {user.first_name or user.username}!\n\n"
                f"Recebemos uma solicitação para redefinir a senha da sua conta no NEXO (usuário: {user.username}).\n\n"
                f"Para criar uma nova senha, acesse o link abaixo:\n"
                f"{reset_url}\n\n"
                f"Este link é válido por 1 hora e só pode ser utilizado uma vez.\n\n"
                f"Se você não solicitou esta redefinição, basta desconsiderar este e-mail. Sua senha atual permanecerá segura.\n\n"
                f"— Equipe NEXO"
            )
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=False,
                )
            except Exception:
                # Falhas de SMTP não devem vazar detalhes para o usuário final
                pass

        # Resposta genérica proposital para evitar enumeração de contas
        return Response(
            {"message": "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha em instantes."}
        )


class PasswordResetConfirmView(APIView):
    """Confirma a redefinição de senha com uid e token."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]

        User = get_user_model()
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({"token": ["Link de redefinição inválido ou expirado."]})

        if not default_token_generator.check_token(user, token):
            raise serializers.ValidationError({"token": ["Link de redefinição inválido ou expirado."]})

        try:
            validate_password(new_password, user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"new_password": list(e.messages)}) from e

        user.set_password(new_password)
        user.save(update_fields=["password"])
        record(user, "auth.password_reset_confirmed", model="User", object_id=user.pk)

        return Response({"message": "Sua senha foi redefinida com sucesso. Você já pode fazer login."})
