"""Testes de integração para registro de Perdas e Avarias (ARC Stone) — deve debitar o
estoque do produto afetado via a mesma rotina de movimentação usada em estoque.py."""


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def test_vendedor_nao_registra_perda(client, make_user, make_product):
    vendedor = make_user(role="vendedor")
    produto = make_product(quantidade_estoque=10)
    _login(client, vendedor)

    resp = client.post("/perdas/", json={
        "produto_id": produto.id, "quantidade": 1, "motivo": "quebra_manuseio", "justificativa": "Caiu no chão durante o transporte.",
    })
    assert resp.status_code == 403


def test_registrar_perda_debita_estoque_e_gera_movimentacao(client, make_user, make_product, db_session):
    import models
    estoquista = make_user(role="estoquista")
    produto = make_product(quantidade_estoque=10)
    _login(client, estoquista)

    resp = client.post("/perdas/", json={
        "produto_id": produto.id,
        "quantidade": 3,
        "motivo": "quebra_transporte",
        "justificativa": "Chapa trincou durante o transporte até a obra.",
    })
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["produto_nome"] == produto.nome
    assert body["usuario_nome"] == estoquista.nome

    db_session.refresh(produto)
    assert produto.quantidade_estoque == 7

    mov = db_session.query(models.MovimentacaoEstoque).filter(
        models.MovimentacaoEstoque.produto_id == produto.id, models.MovimentacaoEstoque.tipo == "SAIDA"
    ).first()
    assert mov is not None
    assert mov.quantidade == 3

    listadas = client.get("/perdas/").json()
    assert any(p["id"] == body["id"] for p in listadas)


def test_registrar_perda_sem_estoque_suficiente_bloqueado(client, make_user, make_product):
    estoquista = make_user(role="estoquista")
    produto = make_product(quantidade_estoque=2)
    _login(client, estoquista)

    resp = client.post("/perdas/", json={
        "produto_id": produto.id, "quantidade": 5, "motivo": "outro", "justificativa": "Quantidade maior que o disponível.",
    })
    assert resp.status_code == 400
    assert "estoque" in resp.json()["detail"].lower()


def test_motivo_invalido_rejeitado(client, make_user, make_product):
    admin = make_user(role="admin")
    produto = make_product(quantidade_estoque=10)
    _login(client, admin)

    resp = client.post("/perdas/", json={
        "produto_id": produto.id, "quantidade": 1, "motivo": "motivo_inventado", "justificativa": "Teste de motivo inválido.",
    })
    assert resp.status_code == 422
