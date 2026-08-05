"""Testes de integração para login, MFA, recuperação de senha e RBAC básico."""
import uuid
from datetime import datetime, timedelta, timezone

import pyotp
from jose import jwt

import auth as auth_module
import models
from main import health_check


def test_create_access_token_usa_expiracao_configurada_por_padrao(monkeypatch):
    """Regressão: token sem expires_delta deve respeitar configuração global."""
    monkeypatch.setattr(auth_module, "ACCESS_TOKEN_EXPIRE_MINUTES", 37)
    token = auth_module.create_access_token({"sub": "config@example.com"})
    payload = jwt.decode(
        token,
        auth_module.SECRET_KEY,
        algorithms=[auth_module.ALGORITHM],
        options={"verify_exp": False},
    )

    expected_exp = datetime.now(timezone.utc).timestamp() + (37 * 60)
    assert payload["type"] == auth_module.TOKEN_TYPE_ACCESS
    assert abs(payload["exp"] - expected_exp) < 5


def test_health_check_nao_vaza_detalhes_do_driver():
    """Regressão: resposta pública não pode carregar DSN ou credenciais do banco."""
    class FailingSession:
        def execute(self, _query):
            raise RuntimeError("postgresql://user:senha-secreta@db:5432/arc_erp")

    response = health_check(FailingSession())

    assert response.status_code == 503
    assert b"senha-secreta" not in response.body
    assert b"indispon" in response.body


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


def _reset_token(user, rtv=None):
    return auth_module.create_access_token(
        data={"sub": user.email, "type": auth_module.TOKEN_TYPE_RESET, "rtv": user.reset_token_version if rtv is None else rtv},
        expires_delta=timedelta(hours=1),
    )


def test_reset_password_token_valido_troca_senha(client, make_user):
    user = make_user(password="SenhaAntiga@123")
    reset_token = _reset_token(user)
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
    resp = client.post("/auth/reset-password", json={"token": _reset_token(user), "new_password": "curta"})
    assert resp.status_code == 400


def test_reset_password_exige_mesma_complexidade_da_criacao(client, make_user):
    """Regressão do achado F6: reset não pode aceitar senha mais fraca que a criação exigiria."""
    user = make_user()
    resp = client.post("/auth/reset-password", json={"token": _reset_token(user), "new_password": "somenteminusculas"})
    assert resp.status_code == 400
    assert "maiúscula" in resp.json()["detail"].lower() or "número" in resp.json()["detail"].lower()


def test_reset_password_token_uso_unico(client, make_user):
    """Regressão do achado F3: token de reset não pode ser reaplicado depois de usado."""
    user = make_user(password="SenhaAntiga@123")
    token = _reset_token(user)

    primeiro = client.post("/auth/reset-password", json={"token": token, "new_password": "SenhaNova@456"})
    assert primeiro.status_code == 200

    segundo = client.post("/auth/reset-password", json={"token": token, "new_password": "OutraSenha@789"})
    assert segundo.status_code == 400

    # A senha do primeiro reset continua valendo — o segundo não teve efeito
    login = client.post("/auth/login", data={"username": user.email, "password": "SenhaNova@456"})
    assert login.status_code == 200


def test_reset_password_rejeita_token_de_outro_tipo(client, make_user):
    """Um access_token comum não pode ser usado para redefinir senha."""
    user = make_user()
    access_token = auth_module.create_access_token(
        data={"sub": user.email, "type": auth_module.TOKEN_TYPE_ACCESS},
        expires_delta=timedelta(minutes=15),
    )
    resp = client.post("/auth/reset-password", json={"token": access_token, "new_password": "SenhaNova@456"})
    assert resp.status_code == 401


def test_login_falho_gera_audit_log(client, make_user, db_session):
    """Regressão do achado adversarial H: tentativa de login com senha errada vira AuditLog."""
    user = make_user()
    resp = client.post("/auth/login", data={"username": user.email, "password": "SenhaErrada@999"})
    assert resp.status_code == 401

    log = db_session.query(models.AuditLog).filter(
        models.AuditLog.usuario_id == user.id, models.AuditLog.acao == "LOGIN_FALHOU"
    ).first()
    assert log is not None


def test_mfa_disable_exige_senha_correta(client, make_user):
    secret = pyotp.random_base32()
    user = make_user(mfa_enabled=True, totp_secret=secret, password="SenhaCorreta@123")
    # login exige MFA — completa o fluxo antes de tentar desativar
    login = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    mfa_token = login.json()["mfa_token"]
    ok_code = pyotp.TOTP(secret).now()
    client.post("/auth/mfa-login", json={"mfa_token": mfa_token, "code": ok_code})

    negado = client.post("/auth/disable-mfa", json={"password": "SenhaErrada@999"})
    assert negado.status_code == 401

    permitido = client.post("/auth/disable-mfa", json={"password": "SenhaCorreta@123"})
    assert permitido.status_code == 200

    # Depois de desativado, login não pede mais MFA
    novo_login = client.post("/auth/login", data={"username": user.email, "password": "SenhaCorreta@123"})
    assert novo_login.json()["mfa_required"] is False


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
