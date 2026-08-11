"""Catálogos configuráveis: ordem, ativo e a regra de item padrão do sistema."""


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def _tipos(client):
    return client.get("/catalogos/tipos-pagamento").json()


def test_seed_cria_tipos_e_formas_padrao(client, make_user):
    _login(client, make_user(role="admin"))
    tipos = _tipos(client)
    nomes = [t["nome"] for t in tipos]
    assert "Cartão" in nomes and "Pix" in nomes
    # Só Cartão abre a segunda etapa da cascata.
    cartao = next(t for t in tipos if t["nome"] == "Cartão")
    assert cartao["exige_forma"] is True
    assert all(t["exige_forma"] is False for t in tipos if t["nome"] != "Cartão")
    assert all(t["built_in"] is True for t in tipos)

    formas = client.get(f"/catalogos/formas-pagamento?tipo_pagamento_id={cartao['id']}").json()
    assert sorted(f["nome"] for f in formas) == ["Crédito", "Débito"]


def test_item_padrao_do_sistema_nao_pode_ser_excluido(client, make_user):
    _login(client, make_user(role="admin"))
    cartao = next(t for t in _tipos(client) if t["nome"] == "Cartão")

    resp = client.delete(f"/catalogos/tipos-pagamento/{cartao['id']}")
    assert resp.status_code == 400
    assert "padrão do sistema" in resp.json()["detail"]

    # Desativar é o caminho previsto para escondê-lo sem apagar histórico.
    assert client.patch(f"/catalogos/tipos-pagamento/{cartao['id']}", json={"ativo": False}).status_code == 200
    assert any(t["id"] == cartao["id"] and t["ativo"] is False for t in _tipos(client))
    client.patch(f"/catalogos/tipos-pagamento/{cartao['id']}", json={"ativo": True})


def test_item_criado_pelo_usuario_pode_ser_excluido(client, make_user):
    _login(client, make_user(role="admin"))
    criado = client.post("/catalogos/locais", json={"nome": "Lavabo"})
    assert criado.status_code == 201, criado.text
    corpo = criado.json()
    assert corpo["built_in"] is False
    # Entra no fim da fila, sem empatar com os semeados.
    assert corpo["ordem"] == max(l["ordem"] for l in client.get("/catalogos/locais").json())
    assert client.delete(f"/catalogos/locais/{corpo['id']}").status_code == 204


def test_reordenar_exige_lista_completa(client, make_user):
    _login(client, make_user(role="admin"))
    ids = [l["id"] for l in client.get("/catalogos/locais").json()]

    # Lista parcial deixaria os ausentes com ordem obsoleta e empates silenciosos.
    assert client.patch("/catalogos/locais/reordenar", json={"ids_em_ordem": ids[:2]}).status_code == 400

    invertido = list(reversed(ids))
    resp = client.patch("/catalogos/locais/reordenar", json={"ids_em_ordem": invertido})
    assert resp.status_code == 200
    assert [l["id"] for l in resp.json()] == invertido
    # Persiste na listagem seguinte, não só na resposta.
    assert [l["id"] for l in client.get("/catalogos/locais").json()] == invertido
    client.patch("/catalogos/locais/reordenar", json={"ids_em_ordem": ids})


def test_apenas_ativos_filtra_desativados(client, make_user):
    _login(client, make_user(role="admin"))
    novo = client.post("/catalogos/locais", json={"nome": "Depósito"}).json()
    client.patch(f"/catalogos/locais/{novo['id']}", json={"ativo": False})

    ativos = [l["id"] for l in client.get("/catalogos/locais?apenas_ativos=true").json()]
    todos = [l["id"] for l in client.get("/catalogos/locais").json()]
    assert novo["id"] not in ativos
    assert novo["id"] in todos
    client.delete(f"/catalogos/locais/{novo['id']}")


def test_forma_exige_tipo_existente(client, make_user):
    _login(client, make_user(role="admin"))
    resp = client.post("/catalogos/formas-pagamento", json={"nome": "X", "tipo_pagamento_id": 999999})
    assert resp.status_code == 404


def test_vendedor_le_mas_nao_gerencia_catalogo(client, make_user):
    _login(client, make_user(role="vendedor"))
    # Leitura é liberada: o Builder precisa da lista para montar o orçamento.
    assert client.get("/catalogos/locais").status_code == 200
    assert client.post("/catalogos/locais", json={"nome": "Proibido"}).status_code == 403
