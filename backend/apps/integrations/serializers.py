from uuid import UUID

from rest_framework import serializers

from .models import PluggyCredential, parse_and_validate_uuid_list


class PluggyCredentialStatusSerializer(serializers.ModelSerializer):
    is_connected = serializers.SerializerMethodField()

    class Meta:
        model = PluggyCredential
        fields = [
            "is_connected",
            "is_active",
            "client_id_masked",
            "item_ids_masked",
            "item_count",
            "last_sync_at",
            "last_sync_status",
            "last_sync_message",
            "last_synced_count",
            "updated_at",
        ]
        read_only_fields = fields

    def get_is_connected(self, obj: PluggyCredential) -> bool:
        return bool(obj and obj.pk and obj.is_active)


class PluggyCredentialUpsertSerializer(serializers.Serializer):
    client_id = serializers.CharField(write_only=True, max_length=64)
    client_secret = serializers.CharField(write_only=True, max_length=256, trim_whitespace=True)
    item_ids = serializers.CharField(
        write_only=True,
        max_length=1024,
        help_text="Um ou mais Item IDs separados por vírgula ou quebra de linha.",
    )
    sync_now = serializers.BooleanField(default=True, required=False)

    def validate_client_id(self, value: str) -> str:
        try:
            return str(UUID(value.strip()))
        except ValueError as exc:
            raise serializers.ValidationError("O Client ID deve ser um código UUID válido.") from exc

    def validate_client_secret(self, value: str) -> str:
        clean = value.strip()
        if len(clean) < 8:
            raise serializers.ValidationError("O Client Secret informado é muito curto ou inválido.")
        return clean

    def validate_item_ids(self, value: str) -> list[str]:
        try:
            items = parse_and_validate_uuid_list(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        if not items:
            raise serializers.ValidationError("Informe pelo menos um Item ID conectado na Pluggy.")
        if len(items) > 10:
            raise serializers.ValidationError("Máximo de 10 Item IDs permitidos por conta.")
        return items

