import hashlib

from slowapi import Limiter
from slowapi.util import get_remote_address


def _rate_limit_ip(request) -> str:
    """Retorna o IP usado nos buckets de autenticação e fallback."""
    return request.headers.get("X-Real-IP") or get_remote_address(request)


def _rate_limit_key(request) -> str:
    """Separa integrações por chave e usuários web por IP.

    Extensões atrás de Cloudflare podem compartilhar o mesmo IP de borda. Usar
    hash da API key evita que uma extensão consuma o limite de outra e nunca
    armazena o segredo bruto no estado do limiter.
    """
    api_key = request.headers.get("X-API-Key")
    if api_key and len(api_key) <= 128:
        digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
        return f"api-key:{digest}"

    # Em produção o Nginx sobrescreve X-Real-IP; em dev, cai para socket.
    return _rate_limit_ip(request)


limiter = Limiter(key_func=_rate_limit_key, default_limits=["100/minute"])
