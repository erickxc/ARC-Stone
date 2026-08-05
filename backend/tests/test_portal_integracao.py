from pathlib import Path

import auth
import models


def _criar_orcamento(
    db_session,
    make_user,
    make_client,
    make_product,
    *,
    email="cliente@example.com",
    status="Orçamento gerado",
    nome_cliente=None,
):
    vendedor = make_user()
    cliente = make_client(
        vendedor,
        email=email,
        nome_fantasia=nome_cliente or "Cliente Portal",
    )
    produto = make_product(
        nome="Produto Portal",
        preco_custo=999,
        preco_venda=15000,
        quantidade_estoque=10,
        quantidade_retida=2,
    )
    orcamento = models.Orcamento(
        cliente_id=cliente.id,
        vendedor_id=vendedor.id,
        tipo_orcamento="Venda",
        status=status,
    )
    db_session.add(orcamento)
    db_session.flush()
    db_session.add(
        models.OrcamentoItem(
            orcamento_id=orcamento.id,
            produto_id=produto.id,
            quantidade=2,
            preco_unitario_aplicado=15000,
            local_instalacao="Sala",
        )
    )
    db_session.commit()
    db_session.refresh(orcamento)
    return vendedor, cliente, produto, orcamento


def _portal_token(orcamento):
    return auth.create_portal_token(orcamento)


def _access_headers(vendedor):
    token = auth.create_access_token({"sub": vendedor.email})
    return {"Authorization": f"Bearer {token}"}


def test_portal_proposta_valida_com_token(client, db_session, make_user, make_client, make_product):
    _, _, _, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )

    resposta = client.get(
        "/portal/proposta",
        headers={"X-Portal-Token": _portal_token(orcamento)},
    )

    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert corpo["orcamento_id"] == orcamento.id
    assert corpo["cliente_nome"] == "Cliente Portal"
    assert corpo["tipo_orcamento"] == "Venda"
    assert corpo["itens"][0]["nome"] == "Produto Portal"
    assert corpo["valor_total"] == 30000


def test_portal_proposta_nao_expoe_campos_internos(
    client, db_session, make_user, make_client, make_product
):
    _, _, _, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )

    resposta = client.get(
        "/portal/proposta",
        headers={"X-Portal-Token": _portal_token(orcamento)},
    )

    assert resposta.status_code == 200, resposta.text
    for campo in ("preco_custo", "vendedor_id", "cnpj_faturamento", "fornecedor_externo"):
        assert campo not in resposta.text


def test_portal_rejeita_token_de_acesso(client, db_session, make_user, make_client, make_product):
    vendedor, _, _, _ = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )

    resposta = client.get(
        "/portal/proposta",
        headers={"X-Portal-Token": auth.create_access_token({"sub": vendedor.email})},
    )

    assert resposta.status_code == 401


def test_portal_rejeita_token_com_versao_revogada(
    client, db_session, make_user, make_client, make_product
):
    _, _, _, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    token = _portal_token(orcamento)
    orcamento.portal_token_version += 1
    db_session.commit()

    resposta = client.get("/portal/proposta", headers={"X-Portal-Token": token})

    assert resposta.status_code == 401


def test_token_de_um_orcamento_nunca_retorna_dados_de_outro(
    client, db_session, make_user, make_client, make_product
):
    _, _, _, proposta_a = _criar_orcamento(
        db_session,
        make_user,
        make_client,
        make_product,
        nome_cliente="Cliente A",
    )
    _, _, _, proposta_b = _criar_orcamento(
        db_session,
        make_user,
        make_client,
        make_product,
        nome_cliente="Cliente B",
    )

    resposta = client.get(
        f"/portal/proposta?orcamento_id={proposta_b.id}",
        headers={"X-Portal-Token": _portal_token(proposta_a)},
    )

    assert resposta.status_code == 200
    assert resposta.json()["orcamento_id"] == proposta_a.id
    assert "Cliente B" not in resposta.text


def test_decisao_recusa_exige_motivo_com_dez_caracteres(
    client, db_session, make_user, make_client, make_product
):
    _, _, _, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    headers = {"X-Portal-Token": _portal_token(orcamento)}

    sem_motivo = client.post(
        "/portal/decisao",
        headers=headers,
        json={"acao": "recusar", "nome": "Ana"},
    )
    motivo_curto = client.post(
        "/portal/decisao",
        headers=headers,
        json={"acao": "recusar", "nome": "Ana", "motivo": "12345"},
    )

    assert sem_motivo.status_code == 422
    assert motivo_curto.status_code == 422


def test_decisao_recusa_persiste_motivo_e_auditoria_publica(
    client, db_session, make_user, make_client, make_product
):
    _, _, _, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    resposta = client.post(
        "/portal/decisao",
        headers={"X-Portal-Token": _portal_token(orcamento)},
        json={
            "acao": "recusar",
            "nome": "Ana Cliente",
            "motivo": "Preciso revisar o prazo de entrega.",
        },
    )

    assert resposta.status_code == 200, resposta.text
    db_session.expire_all()
    salvo = db_session.get(models.Orcamento, orcamento.id)
    log = (
        db_session.query(models.AuditLog)
        .filter(
            models.AuditLog.entidade == "Orcamento",
            models.AuditLog.entidade_id == orcamento.id,
            models.AuditLog.acao == "DECISAO_CLIENTE",
        )
        .order_by(models.AuditLog.id.desc())
        .first()
    )

    assert salvo.decisao_cliente == "recusado"
    assert salvo.status == "Ajuste solicitado"
    assert salvo.decisao_cliente_motivo == "Preciso revisar o prazo de entrega."
    assert log is not None
    assert log.usuario_id is None


def test_decisao_aprovacao_nao_altera_status_estoque_ou_financeiro(
    client, db_session, make_user, make_client, make_product
):
    _, _, produto, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    quantidade_retida_antes = produto.quantidade_retida

    resposta = client.post(
        "/portal/decisao",
        headers={"X-Portal-Token": _portal_token(orcamento)},
        json={"acao": "aprovar", "nome": "Ana Cliente"},
    )

    assert resposta.status_code == 200, resposta.text
    db_session.expire_all()
    salvo = db_session.get(models.Orcamento, orcamento.id)
    produto_salvo = db_session.get(models.Produto, produto.id)
    lancamentos = (
        db_session.query(models.LancamentoFinanceiro)
        .filter(models.LancamentoFinanceiro.orcamento_id == orcamento.id)
        .count()
    )

    assert salvo.decisao_cliente == "aprovado", "decisão do cliente não persistida"
    assert salvo.status == "Orçamento gerado", "aprovação pública alterou o status interno"
    assert lancamentos == 0, "aprovação pública criou lançamento financeiro"
    assert produto_salvo.quantidade_retida == quantidade_retida_antes, (
        "aprovação pública alterou reserva de estoque"
    )


def test_segunda_decisao_da_mesma_proposta_retorna_conflito(
    client, db_session, make_user, make_client, make_product
):
    _, _, _, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    headers = {"X-Portal-Token": _portal_token(orcamento)}

    primeira = client.post(
        "/portal/decisao",
        headers=headers,
        json={"acao": "aprovar", "nome": "Ana Cliente"},
    )
    segunda = client.post(
        "/portal/decisao",
        headers=headers,
        json={
            "acao": "recusar",
            "nome": "Ana Cliente",
            "motivo": "Preciso revisar o orçamento.",
        },
    )

    assert primeira.status_code == 200, primeira.text
    assert segunda.status_code == 409


def test_decisao_de_orcamento_fechado_retorna_conflito(
    client, db_session, make_user, make_client, make_product
):
    _, _, _, orcamento = _criar_orcamento(
        db_session,
        make_user,
        make_client,
        make_product,
        status="Aprovado",
    )

    resposta = client.post(
        "/portal/decisao",
        headers={"X-Portal-Token": _portal_token(orcamento)},
        json={"acao": "aprovar", "nome": "Ana Cliente"},
    )

    assert resposta.status_code == 409


def test_anexo_oculto_nao_pode_ser_baixado(
    client, db_session, make_user, make_client, make_product
):
    _, _, _, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    anexo = models.OrcamentoAnexo(
        orcamento_id=orcamento.id,
        nome_original="interno.pdf",
        url="uploads_private/anexos/interno.pdf",
        extensao=".pdf",
        tamanho=12,
        visivel_cliente=False,
    )
    db_session.add(anexo)
    db_session.commit()

    resposta = client.get(
        f"/portal/anexos/{anexo.id}/download",
        headers={"X-Portal-Token": _portal_token(orcamento)},
    )

    assert resposta.status_code == 404


def test_anexo_de_outro_orcamento_retorna_mesmo_404_do_anexo_oculto(
    client, db_session, make_user, make_client, make_product
):
    _, _, _, proposta_a = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    _, _, _, proposta_b = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    anexo_oculto = models.OrcamentoAnexo(
        orcamento_id=proposta_a.id,
        nome_original="interno.pdf",
        url="uploads_private/anexos/interno.pdf",
        extensao=".pdf",
        tamanho=12,
        visivel_cliente=False,
    )
    anexo_outro = models.OrcamentoAnexo(
        orcamento_id=proposta_b.id,
        nome_original="outro.pdf",
        url="uploads_private/anexos/outro.pdf",
        extensao=".pdf",
        tamanho=12,
        visivel_cliente=True,
    )
    db_session.add_all([anexo_oculto, anexo_outro])
    db_session.commit()
    token = _portal_token(proposta_a)

    oculto = client.get(
        f"/portal/anexos/{anexo_oculto.id}/download",
        headers={"X-Portal-Token": token},
    )
    outro = client.get(
        f"/portal/anexos/{anexo_outro.id}/download",
        headers={"X-Portal-Token": token},
    )

    assert oculto.status_code == 404
    assert outro.status_code == 404
    assert outro.text == oculto.text


def test_anexo_visivel_pode_ser_baixado_com_disposicao_attachment(
    client,
    db_session,
    make_user,
    make_client,
    make_product,
    monkeypatch,
    tmp_path,
):
    _, _, _, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    anexo = models.OrcamentoAnexo(
        orcamento_id=orcamento.id,
        nome_original="publico.pdf",
        url="uploads_private/anexos/publico.pdf",
        extensao=".pdf",
        tamanho=4,
        visivel_cliente=True,
    )
    db_session.add(anexo)
    db_session.commit()
    arquivo = Path(tmp_path) / "publico.pdf"
    arquivo.write_bytes(b"%PDF")

    import routers.portal as portal_router

    monkeypatch.setattr(portal_router, "anexo_disk_path", lambda _: str(arquivo))
    resposta = client.get(
        f"/portal/anexos/{anexo.id}/download",
        headers={"X-Portal-Token": _portal_token(orcamento)},
    )

    assert resposta.status_code == 200, resposta.text
    assert "attachment" in resposta.headers["content-disposition"].lower()


def test_gerar_link_sem_email_do_cliente_retorna_400(
    client, db_session, make_user, make_client, make_product
):
    vendedor, _, _, orcamento = _criar_orcamento(
        db_session,
        make_user,
        make_client,
        make_product,
        email=None,
    )

    resposta = client.post(
        f"/orcamentos/{orcamento.id}/portal-link",
        headers=_access_headers(vendedor),
    )

    assert resposta.status_code == 400


def test_gerar_link_duas_vezes_revoga_o_token_anterior(
    client, db_session, make_user, make_client, make_product
):
    vendedor, _, _, orcamento = _criar_orcamento(
        db_session, make_user, make_client, make_product
    )
    headers = _access_headers(vendedor)

    primeiro = client.post(
        f"/orcamentos/{orcamento.id}/portal-link", headers=headers
    )
    token_anterior = primeiro.json()["url"].split("#portal/", 1)[1]
    segundo = client.post(
        f"/orcamentos/{orcamento.id}/portal-link", headers=headers
    )
    proposta_com_token_anterior = client.get(
        "/portal/proposta",
        headers={"X-Portal-Token": token_anterior},
    )

    assert primeiro.status_code == 200, primeiro.text
    assert segundo.status_code == 200, segundo.text
    assert proposta_com_token_anterior.status_code == 401
