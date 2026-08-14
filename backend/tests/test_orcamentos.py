"""Testes de integração para criação, mudança de status e escopo por vendedor de orçamentos."""


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def _pagamento(client):
    """Payload minimo de pagamento: usa um tipo que nao exige forma (ex: Pix/Dinheiro)."""
    tipos = client.get("/catalogos/tipos-pagamento").json()
    simples = next(t for t in tipos if not t["exige_forma"])
    return {"tipo_pagamento_id": simples["id"]}


def test_criar_orcamento_vendedor_dono_do_cliente(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)

    resp = client.post("/orcamentos/", json={"cliente_id": cliente.id, "tipo_orcamento": "Peça", "itens": []})
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

    resp = client.post("/orcamentos/", json={"cliente_id": cliente_do_dono.id, "tipo_orcamento": "Peça", "itens": []})
    assert resp.status_code == 403


def test_admin_pode_criar_orcamento_para_cliente_de_qualquer_vendedor(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    admin = make_user(role="admin")
    cliente = make_client(vendedor)
    _login(client, admin)

    resp = client.post("/orcamentos/", json={"cliente_id": cliente.id, "tipo_orcamento": "Peça", "itens": []})
    assert resp.status_code == 201
    # Admin sem vendedor_id explícito se auto-atribui, não herda o dono do cliente
    assert resp.json()["vendedor_id"] == admin.id


def test_listagem_de_orcamentos_e_escopada_por_vendedor(client, make_user, make_client):
    vendedor_a = make_user(role="vendedor")
    vendedor_b = make_user(role="vendedor")
    admin = make_user(role="admin")
    cliente_a = make_client(vendedor_a)

    _login(client, vendedor_a)
    criado = client.post("/orcamentos/", json={"cliente_id": cliente_a.id, "tipo_orcamento": "Peça", "itens": []})
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
    criado = client.post("/orcamentos/", json={"cliente_id": cliente_a.id, "tipo_orcamento": "Peça", "itens": []})
    orcamento_id = criado.json()["id"]

    _login(client, vendedor_b)
    negado = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Gerando projeto"})
    assert negado.status_code == 403

    _login(client, vendedor_a)
    permitido = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Gerando projeto"})
    assert permitido.status_code == 200
    assert permitido.json()["status"] == "Gerando projeto"


def test_aprovar_sem_condicao_de_pagamento_e_permitido(client, make_user, make_client):
    """No fluxo formal o pagamento so e escolhido na conversao em venda — que por definicao
    acontece depois de 'Aprovado'. Exigir pagamento antes tornava a proposta impossivel de
    concluir, entao a pendencia foi removida."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={"cliente_id": cliente.id, "tipo_orcamento": "Peça", "itens": []})
    orcamento_id = criado.json()["id"]

    resp = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "Aprovado"


def test_status_invalido_rejeitado(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={"cliente_id": cliente.id, "tipo_orcamento": "Peça", "itens": []})
    orcamento_id = criado.json()["id"]

    resp = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "StatusQueNaoExiste"})
    assert resp.status_code == 400


def test_aprovar_sem_estoque_suficiente_bloqueia(client, make_user, make_client, make_product, make_tipo_peca):
    """Regressão do achado adversarial D: aprovar não pode reter mais do que existe disponível."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=2, quantidade_retida=0)
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça",
        "condicoes_pagamento_selecionadas": "à vista",
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 5, "preco_unitario_aplicado": 1000}],
    })
    assert criado.status_code == 201, criado.text
    orcamento_id = criado.json()["id"]

    resp = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})
    assert resp.status_code == 400
    assert "estoque" in resp.json()["detail"].lower()


def test_aprovar_com_estoque_suficiente_retem_a_quantidade_certa(client, make_user, make_client, make_product, make_tipo_peca, db_session):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça",
        "condicoes_pagamento_selecionadas": "à vista",
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 3, "preco_unitario_aplicado": 1000}],
    })
    orcamento_id = criado.json()["id"]

    resp = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})
    assert resp.status_code == 200

    db_session.refresh(produto)
    assert produto.quantidade_retida == 3


def _criar_orcamento(client, cliente, tipo="Peça"):
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


# Condicoes de pagamento migraram para /catalogos/ — as rotas antigas em /orcamentos/
# foram removidas porque tinham divergido (ignoravam built_in, nao setavam ordem).

def test_condicao_pagamento_vendedor_nao_gerencia(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)

    assert client.post("/catalogos/condicoes-pagamento", json={"nome": "Teste"}).status_code == 403
    assert client.patch("/catalogos/condicoes-pagamento/1", json={"ativo": False}).status_code == 403
    assert client.delete("/catalogos/condicoes-pagamento/1").status_code == 403


def test_condicao_pagamento_admin_cria_desativa_e_exclui(client, make_user):
    admin = make_user(role="admin")
    _login(client, admin)

    criada = client.post("/catalogos/condicoes-pagamento", json={"nome": "3x sem juros (teste)"})
    assert criada.status_code == 201, criada.text
    condicao_id = criada.json()["id"]
    assert criada.json()["ativo"] is True
    assert criada.json()["built_in"] is False

    desativada = client.patch(f"/catalogos/condicoes-pagamento/{condicao_id}", json={"ativo": False})
    assert desativada.status_code == 200
    assert desativada.json()["ativo"] is False

    assert client.delete(f"/catalogos/condicoes-pagamento/{condicao_id}").status_code == 204
    restantes = [item["id"] for item in client.get("/catalogos/condicoes-pagamento").json()]
    assert condicao_id not in restantes


def test_rotas_antigas_de_condicao_pagamento_nao_existem_mais(client, make_user):
    """Duas portas para o mesmo recurso divergem: a antiga deixava excluir item padrao
    do sistema, que a nova recusa com 400."""
    _login(client, make_user(role="admin"))
    # Sem rota propria, o caminho cai em /orcamentos/{orcamento_id} e falha ao converter
    # "condicoes-pagamento" em int (422). O que importa e nao responder 200.
    assert client.get("/orcamentos/condicoes-pagamento").status_code in (404, 422)
    assert client.post("/orcamentos/condicoes-pagamento", json={"nome": "X"}).status_code in (404, 405, 422)


def test_resetar_config_exige_admin(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)
    assert client.post("/orcamentos/config/reset").status_code == 403


def _aprovar_orcamento(client, cliente, make_product, make_tipo_peca):
    """Cria um orçamento com estoque suficiente, aprova e retorna o id — pré-condição
    comum dos testes de conversão em venda (ARC Stone)."""
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    tipo_peca = make_tipo_peca()
    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça",
        "condicoes_pagamento_selecionadas": "à vista",
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 2, "preco_unitario_aplicado": 1500}],
    })
    assert criado.status_code == 201, criado.text
    orcamento_id = criado.json()["id"]
    aprovado = client.put(f"/orcamentos/{orcamento_id}/status", params={"novo_status": "Aprovado"})
    assert aprovado.status_code == 200, aprovado.text
    return orcamento_id


def test_converter_venda_exige_status_aprovado(client, make_user, make_client):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)
    orcamento_id = _criar_orcamento(client, cliente)

    resp = client.post(f"/orcamentos/{orcamento_id}/converter-venda", json=_pagamento(client))
    assert resp.status_code == 400
    assert "aprovado" in resp.json()["detail"].lower()


def test_converter_venda_com_orcamento_aprovado(client, make_user, make_client, make_product, make_tipo_peca):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)
    orcamento_id = _aprovar_orcamento(client, cliente, make_product, make_tipo_peca)

    resp = client.post(f"/orcamentos/{orcamento_id}/converter-venda", json=_pagamento(client))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["orcamento_id"] == orcamento_id
    assert body["valor_total"] == 3000  # 2 * 1500

    historico = client.get("/orcamentos/vendas/historico").json()
    assert any(v["orcamento_id"] == orcamento_id for v in historico)


def test_converter_venda_duas_vezes_e_idempotente(client, make_user, make_client, make_product, make_tipo_peca):
    """Retry apos timeout nao pode virar erro nem duplicar a venda: a segunda chamada
    devolve exatamente a mesma Venda."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)
    orcamento_id = _aprovar_orcamento(client, cliente, make_product, make_tipo_peca)

    primeira = client.post(f"/orcamentos/{orcamento_id}/converter-venda", json=_pagamento(client))
    assert primeira.status_code == 201
    repetida = client.post(f"/orcamentos/{orcamento_id}/converter-venda", json=_pagamento(client))
    assert repetida.status_code == 201
    assert repetida.json()["id"] == primeira.json()["id"]

    vendas = [v for v in client.get("/orcamentos/vendas/historico").json() if v["orcamento_id"] == orcamento_id]
    assert len(vendas) == 1


def test_converter_venda_de_outro_vendedor_negado(client, make_user, make_client, make_product, make_tipo_peca):
    dono = make_user(role="vendedor")
    outro = make_user(role="vendedor")
    cliente = make_client(dono)
    _login(client, dono)
    orcamento_id = _aprovar_orcamento(client, cliente, make_product, make_tipo_peca)

    _login(client, outro)
    resp = client.post(f"/orcamentos/{orcamento_id}/converter-venda", json=_pagamento(client))
    assert resp.status_code == 403
