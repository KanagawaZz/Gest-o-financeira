"""Criptografia autenticada AES-256-GCM para credenciais bancárias (Open Finance).

Garantias de segurança:
- Chave de 256 bits derivada via HKDF-SHA256 a partir de OPEN_FINANCE_ENCRYPTION_KEY (ou SECRET_KEY).
- Nonce aleatório de 96 bits (os.urandom(12)) exclusivo por operação.
- Associated Data (AAD) vincula criptograficamente o segredo ao `owner_id` e ao `field_name`,
  impedindo transplante de ciphertext entre usuários ou entre colunas no banco de dados.
- Nunca expõe chaves ou textos em claro em exceções, logs ou repr.
"""
import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from django.conf import settings

_VERSION_PREFIX = "v1:"
_NONCE_BYTES = 12
_HKDF_SALT = b"nexo-open-finance-hkdf-salt-v1"
_HKDF_INFO = b"nexo-pluggy-credentials-aes256gcm"


class CredentialDecryptionError(Exception):
    """Falha ao descriptografar ou validar a autenticidade da credencial armazenada."""


def _derive_aes256_key() -> bytes:
    raw_secret = os.environ.get("OPEN_FINANCE_ENCRYPTION_KEY", "").strip() or getattr(settings, "SECRET_KEY", "")
    if not raw_secret or len(raw_secret) < 16:
        raise RuntimeError("Chave mestra de criptografia (OPEN_FINANCE_ENCRYPTION_KEY / SECRET_KEY) ausente ou fraca.")
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_HKDF_SALT,
        info=_HKDF_INFO,
    )
    return hkdf.derive(raw_secret.encode("utf-8"))


def _build_aad(owner_id: int, field_name: str) -> bytes:
    return f"nexo:v1:user:{int(owner_id)}:field:{field_name}".encode("utf-8")


def encrypt_credential(plaintext: str, *, owner_id: int, field_name: str) -> str:
    """Criptografa `plaintext` com AES-256-GCM autenticado pelo `owner_id` e `field_name`."""
    clean = plaintext.strip()
    if not clean:
        raise ValueError("Credencial vazia não pode ser criptografada.")
    key = _derive_aes256_key()
    nonce = os.urandom(_NONCE_BYTES)
    aad = _build_aad(owner_id, field_name)
    ciphertext = AESGCM(key).encrypt(nonce, clean.encode("utf-8"), aad)
    payload = base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")
    return f"{_VERSION_PREFIX}{payload}"


def decrypt_credential(token: str, *, owner_id: int, field_name: str) -> str:
    """Descriptografa e valida a autenticidade do token AES-256-GCM em memória."""
    if not token or not token.startswith(_VERSION_PREFIX):
        raise CredentialDecryptionError("Formato de credencial criptografada inválido.")
    b64_part = token[len(_VERSION_PREFIX) :]
    try:
        raw = base64.urlsafe_b64decode(b64_part.encode("ascii"))
    except Exception as exc:  # noqa: BLE001
        raise CredentialDecryptionError("Codificação da credencial corrompida.") from exc

    if len(raw) <= _NONCE_BYTES + 16:
        raise CredentialDecryptionError("Tamanho do pacote criptográfico inválido.")

    nonce = raw[:_NONCE_BYTES]
    ciphertext = raw[_NONCE_BYTES:]
    key = _derive_aes256_key()
    aad = _build_aad(owner_id, field_name)
    try:
        plaintext_bytes = AESGCM(key).decrypt(nonce, ciphertext, aad)
        return plaintext_bytes.decode("utf-8")
    except (InvalidTag, UnicodeDecodeError) as exc:
        raise CredentialDecryptionError(
            "Falha de autenticidade ao descriptografar credencial (chave incorreta ou dados adulterados)."
        ) from exc


def mask_identifier(value: str) -> str:
    """Retorna máscara segura exibindo apenas os 4 últimos caracteres (ex: '••••••••6b75')."""
    clean = (value or "").strip()
    if len(clean) <= 4:
        return "••••"
    return f"••••••••{clean[-4:]}"

