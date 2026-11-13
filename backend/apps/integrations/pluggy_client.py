"""Cliente HTTP seguro para a API oficial da Pluggy (https://api.pluggy.ai).

Regras de segurança:
- Host fixo (`https://api.pluggy.ai`) com verificação obrigatória de certificado TLS.
- Todos os IDs (`item_id`, `account_id`) são validados como UUID antes de compor a URL (anti-SSRF/injection).
- Timeouts explícitos (15s) para evitar bloqueio de workers do Gunicorn.
- Nenhuma mensagem de exceção vaza `clientSecret` ou `X-API-KEY`.
"""
import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from typing import Any
from uuid import UUID

PLUGGY_BASE_URL = "https://api.pluggy.ai"
REQUEST_TIMEOUT_SECONDS = 15
MAX_PAGES_PER_ACCOUNT = 10


class PluggyError(Exception):
    """Erro genérico e sanitizado de comunicação com a Pluggy."""


class PluggyAuthError(PluggyError):
    """Credenciais (`Client ID` / `Client Secret`) recusadas pela Pluggy."""


def _validate_uuid(value: str, label: str = "ID") -> str:
    try:
        return str(UUID(str(value).strip()))
    except ValueError as exc:
        raise PluggyError(f"{label} em formato inválido (esperado UUID).") from exc


class PluggyClient:
    """Cliente autenticado de curta duração (mantém `api_key` apenas em memória durante o ciclo de sync)."""

    def __init__(self, client_id: str, client_secret: str):
        self._client_id = _validate_uuid(client_id, "Client ID")
        self._client_secret = client_secret.strip()
        self._api_key: str | None = None
        self._ssl_ctx = ssl.create_default_context()

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
        authenticated: bool = True,
    ) -> dict[str, Any]:
        if not path.startswith("/"):
            raise ValueError("Path deve iniciar com '/'.")
        url = f"{PLUGGY_BASE_URL}{path}"
        if params:
            query_string = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
            if query_string:
                url = f"{url}?{query_string}"

        headers = {
            "Accept": "application/json",
            "User-Agent": "NEXO-Personal-Finance/1.0",
        }
        if authenticated:
            if not self._api_key:
                self.authenticate()
            headers["X-API-KEY"] = str(self._api_key)

        data_bytes = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data_bytes = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS, context=self._ssl_ctx) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            status = exc.code
            detail = ""
            try:
                err_raw = exc.read().decode("utf-8", errors="ignore")
                err_json = json.loads(err_raw) if err_raw else {}
                if isinstance(err_json, dict):
                    msg = err_json.get("message") or err_json.get("error") or ""
                    if isinstance(msg, str) and msg.strip():
                        detail = f" ({msg.strip()[:140]})"
            except Exception:
                detail = ""
            if status in (401, 403):
                raise PluggyAuthError(
                    "Autenticação recusada pela Pluggy. Verifique seu Client ID, Client Secret e permissões do Item."
                ) from None
            if status == 404:
                raise PluggyError("Recurso ou Item ID não encontrado na Pluggy.") from None
            raise PluggyError(f"A API da Pluggy retornou erro HTTP {status}{detail}.") from None
        except urllib.error.URLError as exc:
            raise PluggyError("Não foi possível conectar à API da Pluggy no momento.") from exc
        except TimeoutError as exc:
            raise PluggyError("Tempo limite excedido ao comunicar com a API da Pluggy.") from exc

    def authenticate(self) -> str:
        """Troca `clientId` e `clientSecret` por um `apiKey` temporário em memória."""
        resp = self._request_json(
            "POST",
            "/auth",
            body={"clientId": self._client_id, "clientSecret": self._client_secret},
            authenticated=False,
        )
        api_key = resp.get("apiKey")
        if not api_key or not isinstance(api_key, str):
            raise PluggyAuthError("Resposta de autenticação da Pluggy não retornou uma apiKey válida.")
        self._api_key = api_key
        return api_key

    def list_accounts(self, item_id: str) -> list[dict[str, Any]]:
        """Lista contas bancárias (`BANK`) e cartões de crédito (`CREDIT`) vinculados a um `item_id`."""
        valid_item_id = _validate_uuid(item_id, "Item ID")
        resp = self._request_json("GET", "/accounts", params={"itemId": valid_item_id})
        results = resp.get("results")
        return results if isinstance(results, list) else []

    def list_transactions(
        self,
        account_id: str,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[dict[str, Any]]:
        """Busca todas as transações paginadas (via cursor `/v2/transactions`) de uma conta na Pluggy."""
        valid_account_id = _validate_uuid(account_id, "Account ID")
        all_results: list[dict[str, Any]] = []
        after_cursor: str | None = None

        for _ in range(MAX_PAGES_PER_ACCOUNT):
            params: dict[str, Any] = {
                "accountId": valid_account_id,
            }
            if after_cursor:
                params["after"] = after_cursor

            resp = self._request_json("GET", "/v2/transactions", params=params)
            results = resp.get("results")
            if not isinstance(results, list) or not results:
                break

            for tx in results:
                raw_date = str(tx.get("date") or "")[:10]
                if len(raw_date) == 10:
                    try:
                        tx_date = date.fromisoformat(raw_date)
                        if date_from and tx_date < date_from:
                            continue
                        if date_to and tx_date > date_to:
                            continue
                    except ValueError:
                        pass
                all_results.append(tx)

            next_query = resp.get("next")
            if not next_query or not isinstance(next_query, str):
                break
            parsed_qs = urllib.parse.parse_qs(next_query.lstrip("?"))
            next_after = parsed_qs.get("after", [None])[0]
            if not next_after or next_after == after_cursor:
                break
            after_cursor = next_after

        return all_results

