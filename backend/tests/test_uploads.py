"""Regressão do achado crítico F1: POST /uploads/url fazia fetch de URL arbitrária sem
o guard anti-SSRF que o resto do projeto já usava (pdf_generator.py)."""


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def test_upload_url_bloqueia_localhost(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)
    resp = client.post("/uploads/url", json={"url": "http://localhost/admin"})
    assert resp.status_code == 400


def test_upload_url_bloqueia_ip_privado_literal(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)
    resp = client.post("/uploads/url", json={"url": "http://169.254.169.254/latest/meta-data/"})
    assert resp.status_code == 400


def test_upload_url_bloqueia_ip_de_rede_interna_docker(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)
    resp = client.post("/uploads/url", json={"url": "http://172.20.0.5:5432/"})
    assert resp.status_code == 400


def test_upload_url_exige_autenticacao(client):
    resp = client.post("/uploads/url", json={"url": "http://localhost/admin"})
    assert resp.status_code == 401
