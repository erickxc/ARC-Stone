"""Testes do endpoint de push de projetos via API key (usado por extensões externas como
SketchUp e, agora, o app Stone)."""
import auth as auth_module
import models
import schemas


def test_contrato_stone_valida_sem_banco():
    payload = schemas.ProjetoCreatePush(
        nome="Projeto Stone",
        origem="stone",
        origem_meta="med-stone 1.0",
        itens=[{"nome": "Bancada", "quantidade": 1}],
    )

    assert payload.origem == "stone"


def _api_key_para(db_session, usuario):
    chave_completa, prefixo, hash_chave = auth_module.generate_api_key()
    db_session.add(models.ApiKey(usuario_id=usuario.id, nome="Chave de teste", prefixo=prefixo, hash_chave=hash_chave))
    db_session.commit()
    return chave_completa


def test_push_com_origem_stone_e_aceito(client, make_user, db_session):
    usuario = make_user(role="vendedor")
    chave = _api_key_para(db_session, usuario)

    resp = client.post("/projetos/push", headers={"X-API-Key": chave}, json={
        "nome": "Projeto Stone Teste",
        "origem": "stone",
        "origem_meta": "Stone projeto abc-123",
        "itens": [{"nome": "Bancada", "quantidade": 1, "material": "Granito Preto", "comprimento": 250.0, "largura": 60.0, "altura": 2.0, "referencia_externa": "peca-uuid-1"}],
    })
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["origem"] == "stone"
    assert body["itens"][0]["referencia_externa"] == "peca-uuid-1"


def test_push_com_origem_invalida_e_rejeitado(client, make_user, db_session):
    usuario = make_user(role="vendedor")
    chave = _api_key_para(db_session, usuario)

    resp = client.post("/projetos/push", headers={"X-API-Key": chave}, json={
        "nome": "Projeto Inválido",
        "origem": "outro_app_qualquer",
        "itens": [{"nome": "Item", "quantidade": 1}],
    })
    assert resp.status_code == 422


def test_push_idempotente_e_normaliza_mm(client, make_user, db_session):
    usuario = make_user(role="vendedor")
    chave = _api_key_para(db_session, usuario)
    payload = {
        "nome": "Bancada Med-Stone",
        "origem": "stone",
        "origem_ref": "projeto-42",
        "origem_rev": "2026-08-05T17:50:00.000Z",
        "origem_status": "rascunho",
        "unidade_dimensao": "mm",
        "itens": [{"nome": "Bancada", "quantidade": 1, "comprimento": 2500, "largura": 600, "altura": 20}],
    }

    primeiro = client.post("/projetos/push", headers={"X-API-Key": chave}, json=payload)
    segundo = client.post("/projetos/push", headers={"X-API-Key": chave}, json=payload)

    assert primeiro.status_code == 201, primeiro.text
    assert segundo.status_code == 200, segundo.text
    assert segundo.json()["id"] == primeiro.json()["id"]
    assert segundo.json()["origem_status"] == "rascunho"
    assert segundo.json()["itens"][0]["comprimento"] == 250.0

    itens = db_session.query(models.ProjetoItem).filter(
        models.ProjetoItem.projeto_id == primeiro.json()["id"],
    ).all()
    assert len(itens) == 1
    assert itens[0].largura == 60.0
    assert db_session.query(models.AuditLog).filter(
        models.AuditLog.acao == "PUSH_IDEMPOTENTE_IGNORADO",
        models.AuditLog.entidade_id == primeiro.json()["id"],
    ).count() == 1


def test_push_revisao_nova_cria_projeto_preservando_anterior(client, make_user, db_session):
    usuario = make_user(role="vendedor")
    chave = _api_key_para(db_session, usuario)
    base = {
        "nome": "Projeto versionado",
        "origem": "stone",
        "origem_ref": "projeto-versionado",
        "unidade_dimensao": "mm",
        "itens": [{"nome": "Peça", "quantidade": 1, "comprimento": 1000}],
    }

    primeira = client.post("/projetos/push", headers={"X-API-Key": chave}, json={**base, "origem_rev": "v1"})
    segunda = client.post("/projetos/push", headers={"X-API-Key": chave}, json={**base, "origem_rev": "v2"})

    assert primeira.status_code == 201, primeira.text
    assert segunda.status_code == 201, segunda.text
    assert primeira.json()["id"] != segunda.json()["id"]
    assert db_session.query(models.Projeto).filter(
        models.Projeto.origem_ref == "projeto-versionado",
    ).count() == 2


def test_push_unidade_default_cm_e_status_invalido(client, make_user, db_session):
    usuario = make_user(role="vendedor")
    chave = _api_key_para(db_session, usuario)
    sem_unidade = client.post("/projetos/push", headers={"X-API-Key": chave}, json={
        "nome": "Projeto SketchUp", "itens": [{"nome": "Item", "quantidade": 1, "comprimento": 250}],
    })
    invalido = client.post("/projetos/push", headers={"X-API-Key": chave}, json={
        "nome": "Projeto inválido", "origem_status": "publicado",
        "itens": [{"nome": "Item", "quantidade": 1}],
    })

    assert sem_unidade.status_code == 201, sem_unidade.text
    assert sem_unidade.json()["itens"][0]["comprimento"] == 250.0
    assert invalido.status_code == 422


def test_push_mesma_referencia_isola_usuario(client, make_user, db_session):
    usuario_a = make_user(role="vendedor")
    usuario_b = make_user(role="vendedor")
    chave_a = _api_key_para(db_session, usuario_a)
    chave_b = _api_key_para(db_session, usuario_b)
    payload = {
        "nome": "Mesmo projeto na origem", "origem": "stone",
        "origem_ref": "ref-compartilhada", "origem_rev": "v1",
        "itens": [{"nome": "Item", "quantidade": 1}],
    }

    resposta_a = client.post("/projetos/push", headers={"X-API-Key": chave_a}, json=payload)
    resposta_b = client.post("/projetos/push", headers={"X-API-Key": chave_b}, json=payload)

    assert resposta_a.status_code == 201
    assert resposta_b.status_code == 201
    assert resposta_a.json()["id"] != resposta_b.json()["id"]


def test_listagem_filtra_origem_e_referencia_no_escopo_do_usuario(client, make_user, db_session):
    usuario_a = make_user(role="vendedor")
    usuario_b = make_user(role="vendedor")
    chave_a = _api_key_para(db_session, usuario_a)
    chave_b = _api_key_para(db_session, usuario_b)
    base = {
        "nome": "Projeto filtrável", "origem": "stone", "origem_ref": "ref-filtrada",
        "origem_rev": "v1", "itens": [{"nome": "Item", "quantidade": 1}],
    }
    client.post("/projetos/push", headers={"X-API-Key": chave_a}, json=base)
    client.post("/projetos/push", headers={"X-API-Key": chave_a}, json={**base, "origem_rev": "v2"})
    client.post("/projetos/push", headers={"X-API-Key": chave_b}, json=base)

    login = client.post("/auth/login", data={"username": usuario_a.email, "password": usuario_a._plain_password})
    assert login.status_code == 200, login.text
    resposta = client.get("/projetos/?origem=stone&origem_ref=ref-filtrada")

    assert resposta.status_code == 200, resposta.text
    projetos = resposta.json()
    assert len(projetos) == 2
    assert all(projeto["usuario_id"] == usuario_a.id for projeto in projetos)


def test_push_sem_api_key_e_rejeitado(client):
    resp = client.post("/projetos/push", json={"nome": "X", "origem": "stone", "itens": [{"nome": "Item", "quantidade": 1}]})
    assert resp.status_code == 401
