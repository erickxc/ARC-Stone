"""Testes unitários para o escape de campos de texto livre no PDF (achado F2 da auditoria:
markup do ReportLab interpretado sem escape podia quebrar a geração ou injetar markup/link)."""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from pdf_generator import build_client_section, build_items_table, esc, get_styles  # noqa: E402


def test_esc_neutraliza_caracteres_de_markup():
    assert esc("<b>tag</b>") == "&lt;b&gt;tag&lt;/b&gt;"
    assert esc("A & B") == "A &amp; B"
    assert esc(None) == ""
    assert esc(123) == "123"


def test_esc_neutraliza_tentativa_de_link_injetado():
    payload = '<a href="http://evil.example/phish">clique aqui</a>'
    escaped = esc(payload)
    assert "<a " not in escaped
    assert "&lt;a " in escaped


def test_build_client_section_nao_quebra_com_tag_nao_fechada():
    styles = get_styles()
    orcamento_data = {
        "cliente_nome": "5cm <b>largura",  # tag não fechada — quebraria o parser do ReportLab sem escape
        "cliente_contato": "11999999999",
        "cliente_email": "cliente@example.com",
        "cliente_cpf_cnpj": "111.111.111-11",
        "cliente_responsavel": "Fulano <script>alert(1)</script>",
        "cliente_endereco": "Rua Teste, 1",
        "tipo_orcamento": "Venda",
    }
    # Não deve levantar exceção — se o texto não fosse escapado, o parser do ReportLab quebraria aqui.
    elements = build_client_section(orcamento_data, styles)
    assert len(elements) > 0


def test_build_items_table_escapa_descricao_e_local_instalacao():
    styles = get_styles()
    itens = [{
        "is_externo": True,
        "nome_externo": "Sofá <b>3 lugares",
        "descricao_externa": '<a href="http://evil.example">clique</a>',
        "local_instalacao": "Sala & varanda",
        "personalizacao_aplicada": None,
        "prazo_entrega_valor": None,
        "prazo_entrega_unidade": None,
        "quantidade": 1,
        "preco_unitario_aplicado": 100000,
    }]
    # Não deve levantar exceção — cobre o mesmo caminho que quebrava POST /orcamentos/{id}/regenerate-pdf
    elements, total = build_items_table(itens, styles)
    assert total == 100000 + 25000  # subtotal do item + frete fixo embutido na função
    assert len(elements) > 0
