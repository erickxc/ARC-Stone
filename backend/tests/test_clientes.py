"""Testes de integração para clientes: escopo por vendedor, duplicidade de CPF/CNPJ e o
vazamento cross-tenant corrigido (achado adversarial C) sem quebrar a unicidade global."""
import uuid


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def test_vendedor_dup_cpf_cnpj_na_propria_carteira_bloqueado(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    cpf = f"{uuid.uuid4().hex[:11]}"
    make_client(vendedor, cpf_cnpj=cpf)
    _login(client, vendedor)

    resp = client.post("/clientes/", json={"tipo_pessoa": "juridica", "razao_social": "Cliente Duplicado", "cpf_cnpj": cpf, "status": "ativo"})
    assert resp.status_code == 400


def test_vendedor_nao_descobre_cliente_de_outro_vendedor_via_dup_check(client, make_user, make_client):
    """Regressão do achado adversarial C: a mensagem não pode confirmar que o CPF/CNPJ
    pertence a outro vendedor — só deve dizer que não foi possível cadastrar."""
    dono = make_user(role="vendedor")
    outro = make_user(role="vendedor")
    cpf = f"{uuid.uuid4().hex[:11]}"
    make_client(dono, cpf_cnpj=cpf)

    _login(client, outro)
    resp = client.post("/clientes/", json={"tipo_pessoa": "juridica", "razao_social": "Tentativa", "cpf_cnpj": cpf, "status": "ativo"})

    # A unicidade global continua valendo (não dá pra cadastrar), mas sem a mensagem que
    # confirma que já existe "no sistema" — só a genérica de falha na constraint do banco.
    assert resp.status_code == 400
    assert "já cadastrado no sistema" not in resp.json()["detail"].lower()


def test_admin_ve_mensagem_especifica_de_duplicidade(client, make_user, make_client):
    """Admin já tem visibilidade legítima de tudo — pode continuar recebendo a mensagem clara."""
    vendedor = make_user(role="vendedor")
    admin = make_user(role="admin")
    cpf = f"{uuid.uuid4().hex[:11]}"
    make_client(vendedor, cpf_cnpj=cpf)

    _login(client, admin)
    resp = client.post("/clientes/", json={"tipo_pessoa": "juridica", "razao_social": "Tentativa Admin", "cpf_cnpj": cpf, "status": "ativo"})
    assert resp.status_code == 400
    assert "já cadastrado no sistema" in resp.json()["detail"].lower()


def test_clientes_crud_gera_audit_log(client, make_user, db_session):
    """Regressão do achado adversarial F: create/update/delete de cliente ficavam sem log."""
    import models
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)

    criado = client.post("/clientes/", json={"tipo_pessoa": "juridica", "razao_social": "Cliente Auditado", "status": "ativo"})
    assert criado.status_code == 201
    cliente_id = criado.json()["id"]

    log_criacao = db_session.query(models.AuditLog).filter(
        models.AuditLog.entidade == "Cliente", models.AuditLog.entidade_id == cliente_id, models.AuditLog.acao == "CRIOU_CLIENTE"
    ).first()
    assert log_criacao is not None

    client.delete(f"/clientes/{cliente_id}")
    log_exclusao = db_session.query(models.AuditLog).filter(
        models.AuditLog.entidade == "Cliente", models.AuditLog.entidade_id == cliente_id, models.AuditLog.acao == "EXCLUIU_CLIENTE"
    ).first()
    assert log_exclusao is not None
