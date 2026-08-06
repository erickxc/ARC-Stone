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


def _criar_orcamento(client, cliente, tipo="Venda"):
    resp = client.post("/orcamentos/", json={"cliente_id": cliente.id, "tipo_orcamento": tipo, "itens": []})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_excluir_orcamento_de_outro_vendedor_negado(client, make_user, make_client):
    dono = make_user(role="vendedor")
    outro = make_user(role="vendedor")
    cliente = make_client(dono)
    _login(client, dono)
    orcamento_id = _criar_orcamento(client, cliente)

    _login(client, outro)
    resp = client.delete(f"/orcamentos/{orcamento_id}")
    assert resp.status_code == 403

    # Continua existindo para o dono: a recusa nao pode ter apagado nada pelo caminho.
    _login(client, dono)
    assert client.get(f"/orcamentos/{orcamento_id}").status_code == 200


def test_vendedor_dono_exclui_o_proprio_orcamento(client, make_user, make_client):
    dono = make_user(role="vendedor")
    cliente = make_client(dono)
    _login(client, dono)
    orcamento_id = _criar_orcamento(client, cliente)

    assert client.delete(f"/orcamentos/{orcamento_id}").status_code == 204
    assert client.get(f"/orcamentos/{orcamento_id}").status_code == 404


def test_admin_exclui_orcamento_de_outro_vendedor(client, make_user, make_client):
    dono = make_user(role="vendedor")
    admin = make_user(role="admin")
    cliente = make_client(dono)
    _login(client, dono)
    orcamento_id = _criar_orcamento(client, cliente)

    _login(client, admin)
    assert client.delete(f"/orcamentos/{orcamento_id}").status_code == 204


def test_renovar_orcamento_de_venda_recusado(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)
    orcamento_id = _criar_orcamento(client, cliente, tipo="Venda")

    resp = client.post(f"/orcamentos/{orcamento_id}/renovar", json={"prazo_valor": 1, "prazo_unidade": "meses"})
    assert resp.status_code == 400
    assert "locacao" in resp.json()["detail"].lower() or "locação" in resp.json()["detail"].lower()


def test_renovar_locacao_sem_data_fim_recusado(client, make_user, make_client):
    """Locacao ainda nao aprovada nao tem data_fim_locacao: renovar nao pode inventar uma."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)
    orcamento_id = _criar_orcamento(client, cliente, tipo="Locacao")

    resp = client.post(f"/orcamentos/{orcamento_id}/renovar", json={"prazo_valor": 1, "prazo_unidade": "meses"})
    assert resp.status_code == 400


def test_renovar_orcamento_de_outro_vendedor_negado(client, make_user, make_client):
    dono = make_user(role="vendedor")
    outro = make_user(role="vendedor")
    cliente = make_client(dono)
    _login(client, dono)
    orcamento_id = _criar_orcamento(client, cliente, tipo="Locacao")

    _login(client, outro)
    resp = client.post(f"/orcamentos/{orcamento_id}/renovar", json={"prazo_valor": 1, "prazo_unidade": "meses"})
    assert resp.status_code == 403


def test_condicao_pagamento_vendedor_nao_gerencia(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)

    assert client.post("/orcamentos/condicoes-pagamento", json={"nome": "Teste"}).status_code == 403
    assert client.patch("/orcamentos/condicoes-pagamento/1", json={"ativo": False}).status_code == 403
    assert client.delete("/orcamentos/condicoes-pagamento/1").status_code == 403


def test_condicao_pagamento_admin_cria_desativa_e_exclui(client, make_user):
    admin = make_user(role="admin")
    _login(client, admin)

    criada = client.post("/orcamentos/condicoes-pagamento", json={"nome": "3x sem juros (teste)"})
    assert criada.status_code == 200, criada.text
    condicao_id = criada.json()["id"]
    assert criada.json()["ativo"] is True

    desativada = client.patch(f"/orcamentos/condicoes-pagamento/{condicao_id}", json={"ativo": False})
    assert desativada.status_code == 200
    assert desativada.json()["ativo"] is False

    assert client.delete(f"/orcamentos/condicoes-pagamento/{condicao_id}").status_code == 204
    restantes = [item["id"] for item in client.get("/orcamentos/condicoes-pagamento").json()]
    assert condicao_id not in restantes


def test_resetar_config_exige_admin(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)
    assert client.post("/orcamentos/config/reset").status_code == 403
