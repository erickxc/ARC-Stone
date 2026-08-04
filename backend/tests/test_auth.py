"""Testes de integração para login, MFA, recuperação de senha e RBAC básico."""
import uuid
from datetime import timedelta

import pyotp

import auth as auth_module


def test_login_sucesso(client, make_user):
    user = make_user(role="vendedor")
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200
    body = resp.json()
    assert body["mfa_required"] is False
    assert body["role"] == "vendedor"
    assert body["nome"] == user.nome
    assert "access_token" in body
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies


def test_login_senha_incorreta(client, make_user):
    user = make_user()
    resp = client.post("/auth/login", data={"username": user.email, "password": "SenhaErrada@999"})
    assert resp.status_code == 401


def test_login_usuario_inativo(client, make_user):
    user = make_user(ativo=False)
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 400
    assert "inativo" in resp.json()["detail"].lower()


def test_login_email_inexistente(client):
    resp = client.post("/auth/login", data={"username": "ninguem.aqui@example.com", "password": "Qualquer@123"})
    assert resp.status_code == 401


def test_mfa_login_fluxo_completo(client, make_user):
    secret = pyotp.random_base32()
    user = make_user(mfa_enabled=True, totp_secret=secret)

    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200
    body = resp.json()
    assert body["mfa_required"] is True
    mfa_token = body["mfa_token"]

    # Código errado não completa o login
    bad = client.post("/auth/mfa-login", json={"mfa_token": mfa_token, "code": "000000"})
    assert bad.status_code == 401

    # Código certo completa o login
    ok_code = pyotp.TOTP(secret).now()
    ok = client.post("/auth/mfa-login", json={"mfa_token": mfa_token, "code": ok_code})
    assert ok.status_code == 200
    assert ok.json()["mfa_required"] is False


def test_forgot_password_mensagem_generica_email_existente_e_inexistente(client, make_user):
    user = make_user()
    existente = client.post("/auth/forgot-password", json={"email": user.email})
    inexistente = client.post("/auth/forgot-password", json={"email": "ninguem.aqui@example.com"})
    assert existente.status_code == 200
    assert inexistente.status_code == 200
    assert existente.json()["message"] == inexistente.json()["message"]


def test_reset_password_token_valido_troca_senha(client, make_user):
    user = make_user(password="SenhaAntiga@123")
    reset_token = auth_module.create_access_token(
        data={"sub": user.email, "type": auth_module.TOKEN_TYPE_RESET},
        expires_delta=timedelta(hours=1),
    )
    resp = client.post("/auth/reset-password", json={"token": reset_token, "new_password": "SenhaNova@456"})
    assert resp.status_code == 200

    velha = client.post("/auth/login", data={"username": user.email, "password": "SenhaAntiga@123"})
    assert velha.status_code == 401

    nova = client.post("/auth/login", data={"username": user.email, "password": "SenhaNova@456"})
    assert nova.status_code == 200


def test_reset_password_token_invalido_rejeitado(client):
    resp = client.post("/auth/reset-password", json={"token": "token-invalido", "new_password": "SenhaNova@456"})
    assert resp.status_code == 401


def test_reset_password_senha_curta_rejeitada(client, make_user):
    user = make_user()
    reset_token = auth_module.create_access_token(
        data={"sub": user.email, "type": auth_module.TOKEN_TYPE_RESET},
        expires_delta=timedelta(hours=1),
    )
    resp = client.post("/auth/reset-password", json={"token": reset_token, "new_password": "curta"})
    assert resp.status_code == 400


def test_reset_password_rejeita_token_de_outro_tipo(client, make_user):
    """Um access_token comum não pode ser usado para redefinir senha."""
    user = make_user()
    access_token = auth_module.create_access_token(
        data={"sub": user.email, "type": auth_module.TOKEN_TYPE_ACCESS},
        expires_delta=timedelta(minutes=15),
    )
    resp = client.post("/auth/reset-password", json={"token": access_token, "new_password": "SenhaNova@456"})
    assert resp.status_code == 401


def test_rbac_vendedor_nao_pode_criar_funcionario(client, make_user):
    vendedor = make_user(role="vendedor")
    client.post("/auth/login", data={"username": vendedor.email, "password": vendedor._plain_password})
    resp = client.post("/usuarios/", json={
        "nome": "Novo Funcionário", "email": f"novo.func.{uuid.uuid4().hex[:10]}@example.com",
        "password": "SenhaForte@123", "role": "vendedor",
    })
    assert resp.status_code == 403


def test_rbac_admin_pode_criar_funcionario(client, make_user):
    admin = make_user(role="admin")
    client.post("/auth/login", data={"username": admin.email, "password": admin._plain_password})
    novo_email = f"novo.func.{uuid.uuid4().hex[:10]}@example.com"
    resp = client.post("/usuarios/", json={
        "nome": "Novo Funcionário", "email": novo_email,
        "password": "SenhaForte@123", "role": "vendedor",
    })
    assert resp.status_code == 201
    assert resp.json()["email"] == novo_email


def test_rbac_vendedor_nao_lista_equipe(client, make_user):
    vendedor = make_user(role="vendedor")
    client.post("/auth/login", data={"username": vendedor.email, "password": vendedor._plain_password})
    resp = client.get("/usuarios/")
    assert resp.status_code == 403


def test_rbac_sem_login_nao_acessa_rota_protegida(client):
    resp = client.get("/usuarios/me")
    assert resp.status_code == 401
