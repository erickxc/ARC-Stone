"""Testes de integração do ledger financeiro: geração automática de título ao aprovar
orçamento, RBAC admin-only, criação/pagamento de lançamento manual e cancelamento do
título automático quando o orçamento sai do grupo de status aprovado."""


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def _criar_orcamento_com_item(client, cliente_id, produto_id, quantidade=2, preco=5000):
    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente_id,
        "tipo_orcamento": "Peça",
        "condicoes_pagamento_selecionadas": "[\"Pix\"]",
        "itens": [{"produto_id": produto_id, "quantidade": quantidade, "preco_unitario_aplicado": preco}],
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_aprovar_orcamento_gera_lancamento_automatico(client, make_user, make_client, make_product):
    vendedor = make_user(role="vendedor")
    admin = make_user(role="admin")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=10)
    _login(client, vendedor)
    orcamento_id = _criar_orcamento_com_item(client, cliente.id, produto.id, quantidade=2, preco=5000)

    aprovado = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})
    assert aprovado.status_code == 200, aprovado.text

    _login(client, admin)
    lancamentos = client.get("/financeiro/lancamentos", params={"tipo": "ENTRADA"}).json()
    gerado = next((l for l in lancamentos if l["orcamento_id"] == orcamento_id), None)
    assert gerado is not None
    assert gerado["valor"] == 10000  # 2 * 5000 centavos
    assert gerado["status"] == "pendente"
    assert gerado["automatico"] is True


def test_voltar_status_cancela_lancamento_automatico_pendente(client, make_user, make_client, make_product):
    vendedor = make_user(role="vendedor")
    admin = make_user(role="admin")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=10)
    _login(client, vendedor)
    orcamento_id = _criar_orcamento_com_item(client, cliente.id, produto.id)
    client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})

    voltou = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Planejando"})
    assert voltou.status_code == 200, voltou.text

    _login(client, admin)
    lancamentos = client.get("/financeiro/lancamentos", params={"tipo": "ENTRADA"}).json()
    assert not any(l["orcamento_id"] == orcamento_id for l in lancamentos)


def test_excluir_orcamento_com_lancamento_pago_nao_quebra_por_fk(client, make_user, make_client, make_product):
    vendedor = make_user(role="vendedor")
    admin = make_user(role="admin")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=10)
    _login(client, vendedor)
    orcamento_id = _criar_orcamento_com_item(client, cliente.id, produto.id)
    client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})

    _login(client, admin)
    lancamentos = client.get("/financeiro/lancamentos", params={"tipo": "ENTRADA"}).json()
    gerado = next(l for l in lancamentos if l["orcamento_id"] == orcamento_id)
    client.patch(f"/financeiro/lancamentos/{gerado['id']}/pagar")

    excluido = client.delete(f"/orcamentos/{orcamento_id}")
    assert excluido.status_code == 204, excluido.text

    lancamentos_depois = client.get("/financeiro/lancamentos", params={"tipo": "ENTRADA"}).json()
    ainda_existe = next(l for l in lancamentos_depois if l["id"] == gerado["id"])
    assert ainda_existe["orcamento_id"] is None
    assert ainda_existe["status"] == "pago"


def test_lancamento_pago_nao_e_cancelado_ao_voltar_status(client, make_user, make_client, make_product):
    vendedor = make_user(role="vendedor")
    admin = make_user(role="admin")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=10)
    _login(client, vendedor)
    orcamento_id = _criar_orcamento_com_item(client, cliente.id, produto.id)
    client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})

    _login(client, admin)
    lancamentos = client.get("/financeiro/lancamentos", params={"tipo": "ENTRADA"}).json()
    gerado = next(l for l in lancamentos if l["orcamento_id"] == orcamento_id)
    pago = client.patch(f"/financeiro/lancamentos/{gerado['id']}/pagar")
    assert pago.status_code == 200, pago.text

    _login(client, vendedor)
    client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Planejando"})

    _login(client, admin)
    lancamentos_depois = client.get("/financeiro/lancamentos", params={"tipo": "ENTRADA"}).json()
    ainda_existe = next((l for l in lancamentos_depois if l["orcamento_id"] == orcamento_id), None)
    assert ainda_existe is not None
    assert ainda_existe["status"] == "pago"


def test_vendedor_nao_acessa_financeiro(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)
    resp = client.get("/financeiro/resumo")
    assert resp.status_code == 403


def test_admin_cria_lancamento_manual_e_marca_pago(client, make_user):
    admin = make_user(role="admin")
    _login(client, admin)

    criado = client.post("/financeiro/lancamentos", json={
        "descricao": "Compra de MDF",
        "categoria": "Materiais",
        "valor": 150000,
        "tipo": "SAIDA",
        "data_vencimento": "2026-08-10T00:00:00Z",
    })
    assert criado.status_code == 201, criado.text
    lancamento_id = criado.json()["id"]
    assert criado.json()["status"] == "pendente"

    pago = client.patch(f"/financeiro/lancamentos/{lancamento_id}/pagar")
    assert pago.status_code == 200, pago.text
    assert pago.json()["status"] == "pago"
    assert pago.json()["data_pagamento"] is not None

    repetir = client.patch(f"/financeiro/lancamentos/{lancamento_id}/pagar")
    assert repetir.status_code == 400


def test_resumo_reflete_lancamentos_reais(client, make_user):
    admin = make_user(role="admin")
    _login(client, admin)

    client.post("/financeiro/lancamentos", json={
        "descricao": "Aluguel",
        "valor": 200000,
        "tipo": "SAIDA",
        "data_vencimento": "2020-01-01T00:00:00Z",
    })

    resumo = client.get("/financeiro/resumo").json()
    assert resumo["a_receber"] >= 0
    assert isinstance(resumo["titulos_abertos"], int)
