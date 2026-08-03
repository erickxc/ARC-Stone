"""Utilitários anti-SSRF para downloads de URL externa."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import HTTPException

# Redes que nunca devem ser alcançadas pelo servidor
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("100.64.0.0/10"),  # CGNAT
]


def _hostname_resolves_to_blocked(hostname: str) -> bool:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Host da URL inválido ou inacessível.")
    for info in infos:
        raw_ip = info[4][0]
        try:
            ip = ipaddress.ip_address(raw_ip)
        except ValueError:
            continue
        for net in _BLOCKED_NETWORKS:
            if ip in net:
                return True
    return False


def assert_public_http_url(url: str) -> str:
    """
    Valida URL http(s) e rejeita hosts que resolvem para IPs privados/metadata.
    Retorna a URL normalizada (strip).
    """
    url = (url or "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL inválida. Apenas HTTP/HTTPS são suportados.")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL sem hostname.")
    hostname = parsed.hostname.lower()
    if hostname in ("localhost", "metadata.google.internal"):
        raise HTTPException(status_code=400, detail="URL não permitida.")
    # Bloqueia IP literal privado na própria URL
    try:
        ip = ipaddress.ip_address(hostname)
        for net in _BLOCKED_NETWORKS:
            if ip in net:
                raise HTTPException(status_code=400, detail="URL não permitida.")
    except ValueError:
        pass  # hostname não é IP literal
    if _hostname_resolves_to_blocked(hostname):
        raise HTTPException(status_code=400, detail="URL não permitida (destino interno).")
    return url
