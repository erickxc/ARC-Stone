"""Testes de integração para o catálogo de serviços (ARC Stone)."""


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def _payload(**overrides):
    base = {
        "nome": "Instalação de bancada",
        "descricao": "Instalação de bancada de granito no local",
        "preco_padrao": 50000,
        "tempo_medio_valor": 3,
        "tempo_medio_unidade": "horas",
    }
    base.update(overrides)
    return base


def test_vendedor_nao_pode_criar_servico(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)
    resp = client.post("/servicos/", json=_payload())
    assert resp.status_code == 403


def test_estoquista_cria_lista_e_edita_servico(client, make_user):
    estoquista = make_user(role="estoquista")
    _login(client, estoquista)

    criado = client.post("/servicos/", json=_payload())
    assert criado.status_code == 201, criado.text
    servico_id = criado.json()["id"]
    assert criado.json()["ativo"] is True

    listados = client.get("/servicos/").json()
    assert any(s["id"] == servico_id for s in listados)

    editado = client.put(f"/servicos/{servico_id}", json={"preco_padrao": 60000})
    assert editado.status_code == 200
    assert editado.json()["preco_padrao"] == 60000
    assert editado.json()["nome"] == "Instalação de bancada"  # não sobrescrito


def test_desativar_servico_e_soft_delete(client, make_user):
    admin = make_user(role="admin")
    _login(client, admin)

    criado = client.post("/servicos/", json=_payload())
    servico_id = criado.json()["id"]

    assert client.delete(f"/servicos/{servico_id}").status_code == 204

    ativos = client.get("/servicos/", params={"ativo": True}).json()
    assert not any(s["id"] == servico_id for s in ativos)

    todos = client.get("/servicos/").json()
    assert any(s["id"] == servico_id for s in todos)


def test_tempo_medio_unidade_invalida_rejeitada(client, make_user):
    admin = make_user(role="admin")
    _login(client, admin)
    resp = client.post("/servicos/", json=_payload(tempo_medio_unidade="semanas"))
    assert resp.status_code == 422


def test_item_de_orcamento_com_servico_herda_prazo_do_servico(client, make_user, make_client):
    """Decisão 3 do plano: prazo_entrega_valor/unidade do item vem do tempo médio do
    serviço quando não informado explicitamente."""
    admin = make_user(role="admin")
    _login(client, admin)
    servico_id = client.post("/servicos/", json=_payload(tempo_medio_valor=5, tempo_medio_unidade="dias")).json()["id"]

    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Venda",
        "itens": [{"servico_id": servico_id, "quantidade": 1, "preco_unitario_aplicado": 50000}],
    })
    assert criado.status_code == 201, criado.text
    item = criado.json()["itens"][0]
    assert item["prazo_entrega_valor"] == 5
    assert item["prazo_entrega_unidade"] == "dias"
    assert item["nome"] == "Instalação de bancada"


def test_item_de_orcamento_sem_tipo_definido_rejeitado(client, make_user, make_client):
    """Validador de schema: nem produto, nem serviço, nem externo — deve rejeitar."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)

    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Venda",
        "itens": [{"quantidade": 1, "preco_unitario_aplicado": 100}],
    })
    assert resp.status_code == 422
