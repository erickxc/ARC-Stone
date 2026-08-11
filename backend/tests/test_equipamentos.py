"""Testes de integração para o cadastro de equipamentos e o inventário de matéria-prima (ARC Stone)."""


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def test_vendedor_nao_acessa_equipamentos(client, make_user):
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)
    assert client.get("/equipamentos/").status_code == 403
    assert client.post("/equipamentos/", json={"nome": "Cortadeira"}).status_code == 403


def test_estoquista_cria_lista_e_muda_estado_do_equipamento(client, make_user):
    estoquista = make_user(role="estoquista")
    _login(client, estoquista)

    criado = client.post("/equipamentos/", json={"nome": "Policorte", "tipo": "corte", "numero_serie": "PC-001"})
    assert criado.status_code == 201, criado.text
    equipamento_id = criado.json()["id"]
    assert criado.json()["estado"] == "operante"

    editado = client.put(f"/equipamentos/{equipamento_id}", json={"estado": "manutencao"})
    assert editado.status_code == 200
    assert editado.json()["estado"] == "manutencao"

    listados = client.get("/equipamentos/").json()
    assert any(e["id"] == equipamento_id for e in listados)


def test_estado_invalido_rejeitado(client, make_user):
    admin = make_user(role="admin")
    _login(client, admin)
    resp = client.post("/equipamentos/", json={"nome": "Guindaste", "estado": "quebrado"})
    assert resp.status_code == 422


def test_materia_prima_crud_com_estoque_fracionado(client, make_user):
    """Matéria-prima usa Numeric (não Integer como Produto) — precisa aceitar m² fracionado."""
    admin = make_user(role="admin")
    _login(client, admin)

    criada = client.post("/materia-prima/", json={
        "nome": "Granito Preto São Gabriel",
        "tipo_material": "granito",
        "unidade_medida": "m2",
        "quantidade_estoque": 12.5,
        "preco_custo": 35000,
    })
    assert criada.status_code == 201, criada.text
    assert float(criada.json()["quantidade_estoque"]) == 12.5

    materia_id = criada.json()["id"]
    editada = client.put(f"/materia-prima/{materia_id}", json={"quantidade_estoque": 9.75})
    assert editada.status_code == 200
    assert float(editada.json()["quantidade_estoque"]) == 9.75

    assert client.delete(f"/materia-prima/{materia_id}").status_code == 204
    ativas = client.get("/materia-prima/", params={"ativo": True}).json()
    assert not any(m["id"] == materia_id for m in ativas)
