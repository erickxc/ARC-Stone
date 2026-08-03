"""Testes anti-SSRF e tipos de token."""
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from ssrf_utils import assert_public_http_url  # noqa: E402


def test_rejeita_localhost():
    with pytest.raises(HTTPException) as exc:
        assert_public_http_url("http://localhost/admin")
    assert exc.value.status_code == 400


def test_rejeita_ip_privado_literal():
    with pytest.raises(HTTPException):
        assert_public_http_url("http://127.0.0.1/secret")
    with pytest.raises(HTTPException):
        assert_public_http_url("http://169.254.169.254/latest/meta-data/")
    with pytest.raises(HTTPException):
        assert_public_http_url("http://192.168.1.1/")


def test_rejeita_esquema_invalido():
    with pytest.raises(HTTPException):
        assert_public_http_url("file:///etc/passwd")


def test_aceita_url_publica_mockada():
    with patch("ssrf_utils._hostname_resolves_to_blocked", return_value=False):
        url = assert_public_http_url("https://example.com/img.jpg")
        assert url.startswith("https://example.com")


def test_rejeita_hostname_que_resolve_privado():
    with patch("ssrf_utils._hostname_resolves_to_blocked", return_value=True):
        with pytest.raises(HTTPException) as exc:
            assert_public_http_url("https://evil.example/x")
        assert "interno" in exc.value.detail.lower() or "não permitida" in exc.value.detail.lower()
