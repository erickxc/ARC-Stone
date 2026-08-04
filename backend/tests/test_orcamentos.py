"""Testes de integração para criação, mudança de status e escopo por vendedor de orçamentos."""


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def test_criar_orcamento_vendedor_dono_do_cliente(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)

    resp = client.post("/orcamentos/", json={"cliente_id": cliente.id, "tipo_orcamento": "Venda", "itens": []})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["vendedor_id"] == vendedor.id
    assert body["cliente_id"] == cliente.id
    assert body["status"] == "Gerando orçamento"


def test_criar_orcamento_para_cliente_de_outro_vendedor_negado(client, make_user, make_client):
    dono = make_user(role="vendedor")
    outro = make_user(role="vendedor")
    cliente_do_dono = make_client(dono)
    _login(client, outro)

    resp = client.post("/orcamentos/", json={"cliente_id": cliente_do_dono.id, "tipo_orcamento": "Venda", "itens": []})
    assert resp.status_code == 403


def test_admin_pode_criar_orcamento_para_cliente_de_qualquer_vendedor(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    admin = make_user(role="admin")
    cliente = make_client(vendedor)
    _login(client, admin)

    resp = client.post("/orcamentos/", json={"cliente_id": cliente.id, "tipo_orcamento": "Venda", "itens": []})
    assert resp.status_code == 201
    # Admin sem vendedor_id explícito se auto-atribui, não herda o dono do cliente
    assert resp.json()["vendedor_id"] == admin.id


def test_listagem_de_orcamentos_e_escopada_por_vendedor(client, make_user, make_client):
    vendedor_a = make_user(role="vendedor")
    vendedor_b = make_user(role="vendedor")
    admin = make_user(role="admin")
    cliente_a = make_client(vendedor_a)

    _login(client, vendedor_a)
    criado = client.post("/orcamentos/", json={"cliente_id": cliente_a.id, "tipo_orcamento": "Venda", "itens": []})
    assert criado.status_code == 201
    orcamento_id = criado.json()["id"]

    vistos_pelo_dono = client.get("/orcamentos/").json()
    assert any(o["id"] == orcamento_id for o in vistos_pelo_dono)

    _login(client, vendedor_b)
    vistos_por_outro = client.get("/orcamentos/").json()
    assert not any(o["id"] == orcamento_id for o in vistos_por_outro)

    _login(client, admin)
    vistos_pelo_admin = client.get("/orcamentos/").json()
    assert any(o["id"] == orcamento_id for o in vistos_pelo_admin)


def test_apenas_o_vendedor_dono_ou_admin_muda_status(client, make_user, make_client):
    vendedor_a = make_user(role="vendedor")
    vendedor_b = make_user(role="vendedor")
    cliente_a = make_client(vendedor_a)

    _login(client, vendedor_a)
    criado = client.post("/orcamentos/", json={"cliente_id": cliente_a.id, "tipo_orcamento": "Venda", "itens": []})
    orcamento_id = criado.json()["id"]

    _login(client, vendedor_b)
    negado = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Planejando"})
    assert negado.status_code == 403

    _login(client, vendedor_a)
    permitido = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Planejando"})
    assert permitido.status_code == 200
    assert permitido.json()["status"] == "Planejando"


def test_aprovar_sem_condicao_de_pagamento_bloqueia_com_pendencia(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={"cliente_id": cliente.id, "tipo_orcamento": "Venda", "itens": []})
    orcamento_id = criado.json()["id"]

    resp = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})
    assert resp.status_code == 400
    assert "pendência" in resp.json()["detail"].lower() or "pagamento" in resp.json()["detail"].lower()


def test_status_invalido_rejeitado(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={"cliente_id": cliente.id, "tipo_orcamento": "Venda", "itens": []})
    orcamento_id = criado.json()["id"]

    resp = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "StatusQueNaoExiste"})
    assert resp.status_code == 400


def test_aprovar_sem_estoque_suficiente_bloqueia(client, make_user, make_client, make_product):
    """Regressão do achado adversarial D: aprovar não pode reter mais do que existe disponível."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=2, quantidade_retida=0)
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Venda",
        "condicoes_pagamento_selecionadas": "à vista",
        "itens": [{"produto_id": produto.id, "quantidade": 5, "preco_unitario_aplicado": 1000}],
    })
    assert criado.status_code == 201, criado.text
    orcamento_id = criado.json()["id"]

    resp = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})
    assert resp.status_code == 400
    assert "estoque" in resp.json()["detail"].lower()


def test_aprovar_com_estoque_suficiente_retem_a_quantidade_certa(client, make_user, make_client, make_product, db_session):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Venda",
        "condicoes_pagamento_selecionadas": "à vista",
        "itens": [{"produto_id": produto.id, "quantidade": 3, "preco_unitario_aplicado": 1000}],
    })
    orcamento_id = criado.json()["id"]

    resp = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})
    assert resp.status_code == 200

    db_session.refresh(produto)
    assert produto.quantidade_retida == 3
