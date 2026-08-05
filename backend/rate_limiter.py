import hashlib

from slowapi import Limiter
from slowapi.util import get_remote_address


def _rate_limit_ip(request) -> str:
    """Retorna o IP usado nos buckets de autenticação e fallback."""
    return request.headers.get("X-Real-IP") or get_remote_address(request)


def api_key_or_ip(request) -> str:
    """Chave de rate limit para rotas de integração autenticadas por API key.

    Extensões atrás de Cloudflare compartilham o IP de borda, então sem isto uma integração
    consumiria o limite da outra. O hash evita guardar o segredo em claro no estado do limiter.

    Use SOMENTE em rota que exija uma API key válida como dependência. Em rota pública, o
    cliente escolheria o próprio balde trocando o header a cada requisição, e o limite deixaria
    de existir — foi exatamente o que aconteceu quando esta função era o key_func global.
    """
    api_key = request.headers.get("X-API-Key")
    if api_key and len(api_key) <= 128:
        digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
        return f"api-key:{digest}"

    # Em produção o Nginx sobrescreve X-Real-IP; em dev, cai para socket.
    return _rate_limit_ip(request)


limiter = Limiter(key_func=_rate_limit_ip, default_limits=["100/minute"])
