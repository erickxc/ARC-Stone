from types import SimpleNamespace

from rate_limiter import _rate_limit_ip, api_key_or_ip, limiter


def test_rate_limit_ip_devolve_x_real_ip_quando_header_esta_presente():
    request = SimpleNamespace(headers={"X-Real-IP": "10.0.0.8"})

    assert _rate_limit_ip(request) == "10.0.0.8"


def test_key_func_global_ignora_api_key_e_agrupa_por_ip():
    request_a = SimpleNamespace(headers={"X-API-Key": "ak_lixo_1", "X-Real-IP": "10.0.0.8"})
    request_b = SimpleNamespace(headers={"X-API-Key": "ak_lixo_2", "X-Real-IP": "10.0.0.8"})

    # Testa o callback configurado no limiter, protegendo contra regressão no default global.
    assert limiter._key_func(request_a) == limiter._key_func(request_b) == "10.0.0.8"


def test_api_key_or_ip_agrupa_por_api_key_quando_presente():
    request_a = SimpleNamespace(headers={"X-API-Key": "ak_chave_a", "X-Real-IP": "10.0.0.1"})
    request_b = SimpleNamespace(headers={"X-API-Key": "ak_chave_a", "X-Real-IP": "10.0.0.2"})

    assert api_key_or_ip(request_a) == api_key_or_ip(request_b)


def test_api_key_or_ip_cai_no_ip_quando_nao_ha_chave():
    request = SimpleNamespace(headers={"X-Real-IP": "10.0.0.8"})

    assert api_key_or_ip(request) == "10.0.0.8"
