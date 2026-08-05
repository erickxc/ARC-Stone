from types import SimpleNamespace

from rate_limiter import _rate_limit_ip, _rate_limit_key


def test_integracoes_sao_limitadas_por_api_key_e_nao_por_ip_de_borda():
    request_a = SimpleNamespace(headers={"X-API-Key": "ak_chave_a", "X-Real-IP": "10.0.0.1"})
    request_b = SimpleNamespace(headers={"X-API-Key": "ak_chave_a", "X-Real-IP": "10.0.0.2"})

    assert _rate_limit_key(request_a) == _rate_limit_key(request_b)


def test_usuarios_web_caem_no_ip_real():
    request = SimpleNamespace(headers={"X-Real-IP": "10.0.0.8"})

    assert _rate_limit_key(request) == "10.0.0.8"


def test_limite_de_auth_usa_ip_mesmo_com_api_key_no_header():
    request_a = SimpleNamespace(headers={"X-API-Key": "ak_lixo_1", "X-Real-IP": "10.0.0.8"})
    request_b = SimpleNamespace(headers={"X-API-Key": "ak_lixo_2", "X-Real-IP": "10.0.0.8"})

    # Os decorators de /auth/* passam explicitamente get_remote_address ao
    # SlowAPI; o header de integração não altera o balde dessas rotas.
    assert _rate_limit_ip(request_a) == _rate_limit_ip(request_b) == "10.0.0.8"
