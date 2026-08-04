from slowapi import Limiter
from slowapi.util import get_remote_address


def _real_client_ip(request) -> str:
    """Usa X-Real-IP quando presente — em produção o nginx sempre sobrescreve esse header com
    o IP real do cliente (proxy_set_header X-Real-IP $remote_addr em nginx.conf), então não é
    spoofável por quem está atrás do proxy. Sem isso, toda requisição chega na API com o mesmo
    request.client.host (o IP do container do nginx), colocando todo mundo no mesmo balde de
    rate limit. Cai para o IP de socket quando não há proxy na frente (dev local)."""
    return request.headers.get("X-Real-IP") or get_remote_address(request)


limiter = Limiter(key_func=_real_client_ip, default_limits=["100/minute"])
