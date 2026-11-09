"""Formato único de erro: {"error": {"code", "message", "details"}}."""
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ValidationError):
        code, message, details = "validation_error", "Dados inválidos.", response.data
    else:
        code = getattr(exc, "default_code", "error")
        detail = response.data.get("detail") if isinstance(response.data, dict) else None
        message = str(detail) if detail else "Não foi possível concluir a operação."
        details = None
        if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            code = "throttled"

    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
