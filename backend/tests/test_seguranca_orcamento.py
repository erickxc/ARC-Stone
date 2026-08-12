"""Regressões das vulnerabilidades encontradas na varredura de segurança.

Cada teste aqui corresponde a um abuso que a API aceitava antes da correção.
"""
import models


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def _pagamento(client):
    tipos = client.get("/catalogos/tipos-pagamento?apenas_ativos=true").json()
    return {"tipo_pagamento_id": next(t for t in tipos if not t["exige_forma"])["id"]}


def test_valores_negativos_rejeitados(client, make_user, make_client, make_product):
    """Preço/quantidade negativos geravam total negativo, que virava crédito inventado
    no ledger financeiro e no valor congelado da Venda."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    _login(client, vendedor)

    for patch in [{"quantidade": -5}, {"quantidade": 0}, {"preco_unitario_aplicado": -100}]:
        item = {"produto_id": produto.id, "quantidade": 1, "preco_unitario_aplicado": 10000,
                "unidade_medida": "un", **patch}
        resp = client.post("/orcamentos/", json={
            "cliente_id": cliente.id, "tipo_orcamento": "Peça", "itens": [item]})
        assert resp.status_code == 422, f"{patch} deveria ser rejeitado, veio {resp.status_code}"


def test_desconto_nao_pode_exceder_o_valor(client, make_user, make_client, make_product):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    _login(client, vendedor)
    item = {"produto_id": produto.id, "quantidade": 1, "preco_unitario_aplicado": 10000, "unidade_medida": "un"}

    # Desconto de fechamento maior que a soma das linhas.
    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça",
        "desconto_global_centavos": 99999999, "itens": [item]})
    assert resp.status_code == 422

    # No limite exato continua valendo — total zero é legítimo (cortesia).
    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça",
        "desconto_global_centavos": 10000, "itens": [item]})
    assert resp.status_code == 201, resp.text
    assert resp.json()["valor_total"] == 0


def test_venda_direta_valida_estoque(client, make_user, make_client, make_product):
    """Venda direta aprova de fato — precisa do mesmo gate de estoque da aprovação
    manual, senão registra venda de peça que não existe."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=2, quantidade_retida=0)
    _login(client, vendedor)

    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça", "modalidade": "venda_direta",
        "pagamento": _pagamento(client),
        "itens": [{"produto_id": produto.id, "quantidade": 99,
                   "preco_unitario_aplicado": 10000, "unidade_medida": "un"}]})
    assert resp.status_code == 400
    assert "estoque insuficiente" in resp.json()["detail"].lower()


def test_venda_direta_retem_estoque_e_gera_titulo(client, make_user, make_client, make_product, db_session):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    _login(client, vendedor)

    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça", "modalidade": "venda_direta",
        "pagamento": _pagamento(client),
        "itens": [{"produto_id": produto.id, "quantidade": 3,
                   "preco_unitario_aplicado": 10000, "unidade_medida": "un"}]})
    assert resp.status_code == 201, resp.text
    orcamento_id = resp.json()["id"]

    db_session.expire_all()
    atualizado = db_session.query(models.Produto).filter(models.Produto.id == produto.id).first()
    assert atualizado.quantidade_retida == 3, "venda direta precisa reter estoque"

    titulos = db_session.query(models.LancamentoFinanceiro).filter(
        models.LancamentoFinanceiro.orcamento_id == orcamento_id).all()
    assert len(titulos) == 1, "venda direta precisa gerar o título a receber"
    assert titulos[0].valor == 30000


def test_orcamento_ja_vendido_nao_pode_ser_editado(client, make_user, make_client, make_product):
    """Editar apagaria os itens sem estornar a retenção de estoque, e a Venda já tem o
    valor congelado — passaria a divergir do orçamento que a originou."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça", "modalidade": "venda_direta",
        "pagamento": _pagamento(client),
        "itens": [{"produto_id": produto.id, "quantidade": 1,
                   "preco_unitario_aplicado": 10000, "unidade_medida": "un"}]})
    assert criado.status_code == 201
    orcamento_id = criado.json()["id"]

    resp = client.put(f"/orcamentos/{orcamento_id}", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça",
        "itens": [{"produto_id": produto.id, "quantidade": 999,
                   "preco_unitario_aplicado": 1, "unidade_medida": "un"}]})
    assert resp.status_code == 400


def test_pagamento_inativo_nao_fecha_venda(client, make_user, make_client, make_product):
    admin = make_user(role="admin")
    _login(client, admin)
    tipos = client.get("/catalogos/tipos-pagamento").json()
    alvo = next(t for t in tipos if not t["exige_forma"])
    client.patch(f"/catalogos/tipos-pagamento/{alvo['id']}", json={"ativo": False})
    try:
        cliente = make_client(admin)
        produto = make_product()
        resp = client.post("/orcamentos/", json={
            "cliente_id": cliente.id, "tipo_orcamento": "Peça", "modalidade": "venda_direta",
            "pagamento": {"tipo_pagamento_id": alvo["id"]},
            "itens": [{"produto_id": produto.id, "quantidade": 1,
                       "preco_unitario_aplicado": 10000, "unidade_medida": "un"}]})
        assert resp.status_code == 404
        assert "inativo" in resp.json()["detail"].lower()
    finally:
        client.patch(f"/catalogos/tipos-pagamento/{alvo['id']}", json={"ativo": True})


def test_criar_motivo_de_perda_gera_slug(client, make_user):
    """O helper genérico não preenchia slug (NOT NULL/unique) e estourava 500."""
    _login(client, make_user(role="admin"))
    resp = client.post("/catalogos/motivos-perda", json={"nome": "Trinca no polimento"})
    assert resp.status_code == 201, resp.text
    assert resp.json()["slug"] == "trinca_no_polimento"
    client.delete(f"/catalogos/motivos-perda/{resp.json()['id']}")


def test_alteracao_de_catalogo_gera_audit_log(client, make_user, db_session):
    """Catálogo muda o comportamento do checkout: alteração de admin precisa deixar rastro."""
    _login(client, make_user(role="admin"))
    criado = client.post("/catalogos/locais", json={"nome": "Sacada auditada"})
    assert criado.status_code == 201
    log = db_session.query(models.AuditLog).filter(
        models.AuditLog.entidade == "Local",
        models.AuditLog.entidade_id == criado.json()["id"],
    ).first()
    assert log is not None and log.acao == "CRIOU_CATALOGO"
    client.delete(f"/catalogos/locais/{criado.json()['id']}")


def test_saida_nao_herda_validacao_de_entrada(client, make_user, make_client, db_session):
    """Apertar uma regra de entrada não pode quebrar a LEITURA do que já está gravado —
    senão uma linha legada derruba a listagem inteira com 500."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    _login(client, vendedor)

    orcamento = models.Orcamento(cliente_id=cliente.id, vendedor_id=vendedor.id,
                                 tipo_orcamento="Peça", status="Gerando orçamento")
    db_session.add(orcamento)
    db_session.flush()
    # Linha gravada antes das regras atuais existirem.
    db_session.add(models.OrcamentoItem(
        orcamento_id=orcamento.id, produto_id=None, is_externo=True, nome_externo="Legado",
        quantidade=-3, preco_unitario_aplicado=-500, unidade_medida="un"))
    db_session.commit()

    assert client.get("/orcamentos/").status_code == 200
    assert client.get(f"/orcamentos/{orcamento.id}").status_code == 200


def test_cliente_legado_fora_do_padrao_nao_derruba_listagem(client, make_user, db_session):
    """ClienteOut herdava as constraints de ClienteCreate: um `contato` acima de 30
    caracteres fazia GET /clientes/ inteiro retornar 500 — não só aquele registro.

    (UF fora do padrão não é testável: a coluna é VARCHAR(2) e o banco já recusa.)
    """
    vendedor = make_user(role="vendedor")
    _login(client, vendedor)
    db_session.add(models.Cliente(
        usuario_id=vendedor.id, nome_fantasia="Legado LTDA",
        contato="(11) 99999-9999 / ramal 4321 / falar com a Ana depois das 14h",
        status="ativo"))
    db_session.commit()

    resposta = client.get("/clientes/")
    assert resposta.status_code == 200
    assert any(c["nome_fantasia"] == "Legado LTDA" for c in resposta.json())
