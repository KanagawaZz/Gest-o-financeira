from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.audit.services import record
from common.crypto import CredentialDecryptionError

from .models import PluggyCredential
from .pluggy_client import PluggyClient, PluggyError
from .serializers import PluggyCredentialStatusSerializer, PluggyCredentialUpsertSerializer
from .services import sync_user_pluggy


def _empty_status_payload() -> dict:
    return {
        "is_connected": False,
        "is_active": False,
        "client_id_masked": "",
        "item_ids_masked": "",
        "item_count": 0,
        "last_sync_at": None,
        "last_sync_status": PluggyCredential.SyncStatus.IDLE,
        "last_sync_message": "",
        "last_synced_count": 0,
        "updated_at": None,
    }


class PluggyCredentialView(APIView):
    """Gerencia a configuração e criptografia das chaves do Meu Pluggy do usuário autenticado."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "pluggy_config"

    def get(self, request):
        cred = PluggyCredential.objects.filter(owner=request.user).first()
        if not cred:
            return Response(_empty_status_payload())
        return Response(PluggyCredentialStatusSerializer(cred).data)

    def put(self, request):
        serializer = PluggyCredentialUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        client_id = data["client_id"]
        client_secret = data["client_secret"]
        item_ids = data["item_ids"]
        sync_now = data.get("sync_now", True)

        # Valida as credenciais diretamente na API da Pluggy antes de persistir
        api = PluggyClient(client_id, client_secret)
        try:
            api.authenticate()
        except PluggyError as exc:
            raise ValidationError({"client_secret": str(exc)}) from exc

        cred = PluggyCredential.objects.filter(owner=request.user).first()
        if not cred:
            cred = PluggyCredential(owner=request.user)

        cred.is_active = True
        cred.set_secrets(client_id=client_id, client_secret=client_secret, item_ids=item_ids)
        cred.last_sync_status = PluggyCredential.SyncStatus.IDLE
        cred.last_sync_message = "Credenciais validadas e criptografadas com AES-256-GCM."
        cred.save()

        record(
            request.user,
            "pluggy.configured",
            cred,
            {"client_id": cred.client_id_masked, "item_count": cred.item_count},
        )

        if sync_now:
            try:
                sync_user_pluggy(cred, client=api)
            except PluggyError as exc:
                raise ValidationError({"detail": str(exc)}) from exc

        cred.refresh_from_db()
        return Response(PluggyCredentialStatusSerializer(cred).data, status=status.HTTP_200_OK)

    def delete(self, request):
        cred = PluggyCredential.objects.filter(owner=request.user).first()
        if cred:
            record(request.user, "pluggy.disconnected", cred, {"client_id": cred.client_id_masked})
            cred.delete()
        return Response(_empty_status_payload(), status=status.HTTP_200_OK)


class PluggySyncView(APIView):
    """Dispara a sincronização imediata sob demanda para o usuário autenticado."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "pluggy_sync"

    def post(self, request):
        cred = PluggyCredential.objects.filter(owner=request.user, is_active=True).first()
        if not cred:
            raise ValidationError({"detail": "Nenhuma credencial ativa do Meu Pluggy encontrada."})

        try:
            result = sync_user_pluggy(cred)
        except (PluggyError, CredentialDecryptionError) as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        cred.refresh_from_db()
        payload = PluggyCredentialStatusSerializer(cred).data
        payload["sync_result"] = result
        return Response(payload, status=status.HTTP_200_OK)

