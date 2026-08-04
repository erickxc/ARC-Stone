"""Testes do endpoint de push de projetos via API key (usado por extensões externas como
SketchUp e, agora, o app Stone)."""
import auth as auth_module
import models


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


def test_push_sem_api_key_e_rejeitado(client):
    resp = client.post("/projetos/push", json={"nome": "X", "origem": "stone", "itens": [{"nome": "Item", "quantidade": 1}]})
    assert resp.status_code == 401
