import re
from uuid import UUID

from django.conf import settings
from django.db import models

from common.crypto import decrypt_credential, encrypt_credential, mask_identifier


def parse_and_validate_uuid_list(raw_items: str | list[str]) -> list[str]:
    """Extrai e valida estritamente uma lista de UUIDs (evita SSRF / Path Traversal)."""
    if isinstance(raw_items, list):
        candidates = [str(item).strip() for item in raw_items if str(item).strip()]
    else:
        candidates = [part.strip() for part in re.split(r"[,;\s]+", raw_items or "") if part.strip()]

    validated: list[str] = []
    seen: set[str] = set()
    for item in candidates:
        try:
            normalized = str(UUID(item))
        except ValueError as exc:
            raise ValueError(f"Identificador '{item[:12]}...' não é um UUID válido.") from exc
        if normalized not in seen:
            seen.add(normalized)
            validated.append(normalized)
    return validated


class PluggyCredential(models.Model):
    """Credenciais individuais do Meu Pluggy criptografadas com AES-256-GCM (AAD vinculado ao usuário)."""

    class SyncStatus(models.TextChoices):
        IDLE = "idle", "Aguardando sincronização"
        RUNNING = "running", "Sincronizando"
        SUCCESS = "success", "Sincronizado com sucesso"
        ERROR = "error", "Falha na sincronização"

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pluggy_credential",
    )
    encrypted_client_id = models.TextField()
    encrypted_client_secret = models.TextField()
    encrypted_item_ids = models.TextField()
    client_id_masked = models.CharField(max_length=24)
    item_ids_masked = models.CharField(max_length=120, blank=True)
    item_count = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(
        max_length=16,
        choices=SyncStatus.choices,
        default=SyncStatus.IDLE,
    )
    last_sync_message = models.CharField(max_length=240, blank=True)
    last_synced_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Credencial Pluggy"
        verbose_name_plural = "Credenciais Pluggy"

    def __str__(self) -> str:
        return f"PluggyCredential(user={self.owner_id}, active={self.is_active})"

    def set_secrets(self, *, client_id: str, client_secret: str, item_ids: list[str]) -> None:
        """Valida e criptografa credenciais em repouso vinculadas ao `owner_id`."""
        if not self.owner_id:
            raise ValueError("O proprietário (owner_id) deve estar definido antes de criptografar.")
        normalized_client_id = str(UUID(client_id.strip()))
        clean_secret = client_secret.strip()
        if len(clean_secret) < 8:
            raise ValueError("Client Secret inválido ou muito curto.")
        validated_items = parse_and_validate_uuid_list(item_ids)
        if not validated_items:
            raise ValueError("Informe pelo menos um Item ID válido.")

        self.encrypted_client_id = encrypt_credential(
            normalized_client_id, owner_id=self.owner_id, field_name="client_id"
        )
        self.encrypted_client_secret = encrypt_credential(
            clean_secret, owner_id=self.owner_id, field_name="client_secret"
        )
        self.encrypted_item_ids = encrypt_credential(
            ",".join(validated_items), owner_id=self.owner_id, field_name="item_ids"
        )
        self.client_id_masked = mask_identifier(normalized_client_id)
        self.item_ids_masked = ", ".join(mask_identifier(i) for i in validated_items[:5])
        self.item_count = len(validated_items)

    def get_decrypted_secrets(self) -> tuple[str, str, list[str]]:
        """Descriptografa em memória apenas durante a chamada à API."""
        client_id = decrypt_credential(self.encrypted_client_id, owner_id=self.owner_id, field_name="client_id")
        client_secret = decrypt_credential(
            self.encrypted_client_secret, owner_id=self.owner_id, field_name="client_secret"
        )
        raw_items = decrypt_credential(self.encrypted_item_ids, owner_id=self.owner_id, field_name="item_ids")
        item_ids = [part for part in raw_items.split(",") if part]
        return client_id, client_secret, item_ids

