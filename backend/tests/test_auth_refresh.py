"""Testes de integração da renovação de sessão (`POST /auth/refresh`).

O refresh é sem estado, revogável por versão em coluna (`Usuario.sessao_token_version`),
seguindo o mesmo padrão de `reset_token_version` e `Orcamento.portal_token_version`.
Os casos de recusa importam mais que o caminho felizardo: a rota cunha credencial.
"""
from datetime import timedelta

import auth as auth_module
import models


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200
    return resp


def _refresh_de(user, ver=0, tipo=None, expira=timedelta(days=7)):
    return auth_module.create_access_token(
        {"sub": user.email, "type": tipo or auth_module.TOKEN_TYPE_REFRESH, "ver": ver},
        expires_delta=expira,
    )


def test_refresh_devolve_par_novo_de_cookies(client, make_user):
    user = make_user(role="vendedor")
    _login(client, user)
    access_antigo = client.cookies.get("access_token")

    resp = client.post("/auth/refresh")

    assert resp.status_code == 200
    assert resp.json()["role"] == "vendedor"
    definidos = resp.headers.get_list("set-cookie")
    assert any("access_token=" in c for c in definidos)
    assert any("refresh_token=" in c for c in definidos)
    assert all("HttpOnly" in c for c in definidos)
    # O token não tem `iat`/`jti`: renovado no mesmo segundo, sai byte a byte igual ao anterior.
    # O que importa é a sessão seguir válida com prazo novo, não o par ser textualmente diferente.
    assert client.cookies.get("access_token") is not None
    assert auth_module.decode_token(access_antigo, expected_types={auth_module.TOKEN_TYPE_ACCESS})["sub"] == user.email


def test_refresh_renovado_serve_para_chamar_rota_autenticada(client, make_user):
    user = make_user(role="vendedor")
    _login(client, user)
    client.cookies.delete("access_token")  # simula access expirado, refresh ainda válido

    assert client.get("/usuarios/me").status_code == 401
    assert client.post("/auth/refresh").status_code == 200
    assert client.get("/usuarios/me").status_code == 200


def test_refresh_sem_cookie_recusa(client):
    assert client.post("/auth/refresh").status_code == 401


def test_refresh_recusa_access_token_no_lugar_do_refresh(client, make_user):
    """Regressão: um access token vazado não pode ser trocado por sessão nova."""
    user = make_user()
    _login(client, user)
    client.cookies.set("refresh_token", client.cookies.get("access_token"))

    assert client.post("/auth/refresh").status_code == 401


def test_refresh_recusa_token_de_reset(client, make_user):
    user = make_user()
    token = _refresh_de(user, tipo=auth_module.TOKEN_TYPE_RESET)
    client.cookies.set("refresh_token", token)

    assert client.post("/auth/refresh").status_code == 401


def test_refresh_recusa_assinatura_invalida(client, make_user):
    user = make_user()
    client.cookies.set("refresh_token", _refresh_de(user) + "adulterado")

    assert client.post("/auth/refresh").status_code == 401


def test_refresh_recusa_token_expirado(client, make_user):
    user = make_user()
    client.cookies.set("refresh_token", _refresh_de(user, expira=timedelta(seconds=-30)))

    assert client.post("/auth/refresh").status_code == 401


def test_refresh_recusa_usuario_inativo(client, make_user, db_session):
    user = make_user()
    _login(client, user)
    user.ativo = False
    db_session.commit()

    assert client.post("/auth/refresh").status_code == 401


def test_refresh_recusa_usuario_inexistente(client, make_user, db_session):
    user = make_user()
    token = _refresh_de(user)
    db_session.delete(user)
    db_session.commit()
    client.cookies.set("refresh_token", token)

    assert client.post("/auth/refresh").status_code == 401


def test_refresh_recusa_versao_antiga(client, make_user, db_session):
    """Coração da revogação: bumpar a coluna invalida refresh já emitido."""
    user = make_user()
    token = _refresh_de(user, ver=0)
    user.sessao_token_version = 1
    db_session.commit()
    client.cookies.set("refresh_token", token)

    assert client.post("/auth/refresh").status_code == 401


def test_logout_invalida_refresh_emitido_antes(client, make_user, db_session):
    user = make_user()
    _login(client, user)
    refresh_copiado = client.cookies.get("refresh_token")

    assert client.post("/auth/logout").status_code == 200
    db_session.refresh(user)
    assert user.sessao_token_version == 1

    client.cookies.set("refresh_token", refresh_copiado)
    assert client.post("/auth/refresh").status_code == 401


def test_logout_sem_cookie_valido_nao_estoura(client):
    client.cookies.set("refresh_token", "isso-nao-e-um-jwt")
    assert client.post("/auth/logout").status_code == 200


def test_troca_de_senha_derruba_sessoes_abertas(client, make_user, db_session):
    user = make_user()
    _login(client, user)
    refresh_copiado = client.cookies.get("refresh_token")

    token_reset = auth_module.create_access_token(
        {"sub": user.email, "type": auth_module.TOKEN_TYPE_RESET, "rtv": user.reset_token_version},
        expires_delta=timedelta(minutes=15),
    )
    resp = client.post("/auth/reset-password", json={"token": token_reset, "new_password": "OutraSenha@456"})
    assert resp.status_code == 200

    db_session.refresh(user)
    assert user.sessao_token_version == 1
    client.cookies.set("refresh_token", refresh_copiado)
    assert client.post("/auth/refresh").status_code == 401


def test_refresh_registra_auditoria_propria(client, make_user, db_session):
    user = make_user()
    _login(client, user)
    assert client.post("/auth/refresh").status_code == 200

    acoes = [log.acao for log in db_session.query(models.AuditLog)
             .filter(models.AuditLog.usuario_id == user.id).all()]
    assert "LOGIN" in acoes
    assert "REFRESH" in acoes
