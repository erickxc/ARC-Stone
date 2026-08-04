"""
Gerador de PDF de Orçamento — ARC ERP.
Usa ReportLab para criar PDFs no padrão visual do projeto.
"""
import os
import uuid
from datetime import datetime
from xml.sax.saxutils import escape as _xml_escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Tokens de marca ARC usados no PDF.
SOMBRA = colors.HexColor('#2E2D2C')
EUCALIPTO = colors.HexColor('#B2C2B2')
LINO = colors.HexColor('#F5F3E9')
LIENZO = colors.HexColor('#EBEBEB')
TERRACOTA = colors.HexColor('#A85A46')

# Mapeamento de legadas para não quebrar estilos da tabela
WOOD = SOMBRA
WOOD_LIGHT = SOMBRA
GOLD = EUCALIPTO
SAND = LINO
NOBLE_GRAY = SOMBRA

PAGE_WIDTH, PAGE_HEIGHT = A4


def esc(value) -> str:
    """Escapa texto de origem do usuário (nome de cliente, item, observação, etc.) antes de
    entrar em markup do ReportLab (Paragraph interpreta um subconjunto de tags tipo XML — sem
    escapar, `<`/`>`/`&` podem quebrar o parser ou injetar markup/link no PDF final)."""
    if value is None:
        return ''
    return _xml_escape(str(value))


def get_styles():
    """Retorna estilos customizados para os PDFs do ARC ERP."""
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        'ArcTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=WOOD,
        spaceAfter=2*mm,
    ))
    styles.add(ParagraphStyle(
        'ArcSubtitle',
        parent=styles['Normal'],
        fontSize=8,
        textColor=NOBLE_GRAY,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        'ArcBody',
        parent=styles['Normal'],
        fontSize=9,
        textColor=NOBLE_GRAY,
        leading=13,
    ))
    styles.add(ParagraphStyle(
        'ArcSmall',
        parent=styles['Normal'],
        fontSize=7.5,
        textColor=NOBLE_GRAY,
        leading=10,
    ))
    styles.add(ParagraphStyle(
        'ArcBold',
        parent=styles['Normal'],
        fontSize=9,
        textColor=NOBLE_GRAY,
        leading=13,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'ArcCenter',
        parent=styles['Normal'],
        fontSize=9,
        textColor=NOBLE_GRAY,
        alignment=TA_CENTER,
    ))
    return styles


def build_header(styles):
    """Constrói o cabeçalho do ARC com identidade e dados configuráveis."""
    elements = []
    
    logo_element = Paragraph(
        '<font size="28" color="#2E2C29"><b>ARC</b></font>',
        styles['ArcTitle']
    )

    company_name = os.getenv("COMPANY_NAME", "ARC ERP")
    company_contact = os.getenv("COMPANY_CONTACT", "ERP de interiores e arquitetura")
    company_address = os.getenv("COMPANY_ADDRESS", "")
    company_document = os.getenv("COMPANY_DOCUMENT", "")
    company_lines = [f'<b>{company_name}</b>', company_contact]
    if company_address:
        company_lines.append(company_address)
    if company_document:
        company_lines.append(company_document)
    company_info = Paragraph(
        '<br/>'.join(company_lines),
        styles['ArcSmall']
    )
    
    # Tabela para alinhar logo à esquerda e info à direita
    header_table = Table(
        [[logo_element, company_info]],
        colWidths=[6*cm, 12*cm]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    
    elements.append(header_table)
    elements.append(Spacer(1, 4*mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=4*mm))
    
    return elements


def build_client_section(orcamento_data, styles):
    """Seção com dados do cliente e data do orçamento."""
    elements = []
    
    data_hoje = datetime.now().strftime("%d de %B de %Y").replace(
        'January', 'janeiro').replace('February', 'fevereiro').replace(
        'March', 'março').replace('April', 'abril').replace(
        'May', 'maio').replace('June', 'junho').replace(
        'July', 'julho').replace('August', 'agosto').replace(
        'September', 'setembro').replace('October', 'outubro').replace(
        'November', 'novembro').replace('December', 'dezembro')
    
    # Monta o bloco de dados do cliente
    client_lines = [
        f'<b>Rio de Janeiro, {data_hoje}</b>',
        f'Nome: <b>{esc(orcamento_data.get("cliente_nome", ""))}</b>     '
        f'Tel.: <b>{esc(orcamento_data.get("cliente_contato", ""))}</b>',
        f'E-mail: <b>{esc(orcamento_data.get("cliente_email", ""))}</b>     '
        f'CPF/CNPJ: <b>{esc(orcamento_data.get("cliente_cpf_cnpj", ""))}</b>',
        f'Responsável: <b>{esc(orcamento_data.get("cliente_responsavel", ""))}</b>',
        f'Endereço de Entrega: <b>{esc(orcamento_data.get("cliente_endereco", ""))}</b>',
    ]

    if orcamento_data.get("arquiteto_nome"):
        client_lines.append(
            f'Arquiteto: <b>{esc(orcamento_data.get("arquiteto_nome"))}</b>     '
            f'Tel. Arquiteto: <b>{esc(orcamento_data.get("arquiteto_contato", ""))}</b>'
        )
    
    tipo = orcamento_data.get("tipo_orcamento", "Venda")
    if tipo == 'Locacao':
        prazo_val = orcamento_data.get("prazo_locacao_valor", "")
        prazo_uni = orcamento_data.get("prazo_locacao_unidade", "")
        if prazo_val:
            client_lines.append(f'Obs.: Orçamento tipo <b>{tipo}</b>')
            client_lines.append(f'<font color="#2E2D2C"><b>Prazo Limite da Locação:</b> {prazo_val} {prazo_uni} corridos. A contagem inicia-se a partir do momento da chegada dos móveis no local.</font>')
        else:
            client_lines.append(f'Obs.: Orçamento tipo <b>{tipo}</b>')
            client_lines.append(f'<font color="#2E2D2C">A contagem do prazo de locação inicia-se a partir do momento da chegada dos móveis no local.</font>')
    else:
        client_lines.append(f'Obs.: Orçamento tipo <b>{tipo}</b>')
    
    for line in client_lines:
        elements.append(Paragraph(line, styles['ArcBody']))
        elements.append(Spacer(1, 1*mm))
    
    elements.append(Spacer(1, 4*mm))
    return elements


def get_item_image(item, max_width=2*cm, max_height=1.5*cm):
    """Tenta carregar a imagem de um item (interno, externo ou URL remota).
    Imagens externas são cacheadas em uploads/cache/ para evitar downloads repetidos."""
    import hashlib
    import urllib.request
    from ssrf_utils import assert_public_http_url
    from fastapi import HTTPException
    
    foto_url = None
    
    if item.get('is_externo') and item.get('foto_externa_url'):
        foto_url = item['foto_externa_url']
    elif item.get('foto_url'):
        foto_url = item['foto_url']
    
    if not foto_url:
        return Paragraph('<font color="#999999" size="7">Sem foto</font>', getSampleStyleSheet()['Normal'])
    
    foto_path = None
    MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
    
    # Caso 1: URL externa (http/https) — baixa e cacheia localmente (anti-SSRF)
    if foto_url.startswith('http://') or foto_url.startswith('https://'):
        cache_dir = os.path.join('uploads', 'cache')
        os.makedirs(cache_dir, exist_ok=True)
        
        ext = os.path.splitext(foto_url.split('?')[0])[1] or '.jpg'
        url_hash = hashlib.md5(foto_url.encode()).hexdigest()
        cached_path = os.path.join(cache_dir, f'{url_hash}{ext}')
        
        if os.path.exists(cached_path):
            foto_path = cached_path
        else:
            try:
                safe_url = assert_public_http_url(foto_url)
                req = urllib.request.Request(safe_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as response:
                    # Não seguir redirects para IPs privados: urllib segue por padrão;
                    # validamos a URL final se diferir
                    final_url = response.geturl()
                    if final_url != safe_url:
                        assert_public_http_url(final_url)
                    data = response.read(MAX_IMAGE_BYTES + 1)
                    if len(data) > MAX_IMAGE_BYTES:
                        raise ValueError("Imagem externa excede 5MB")
                with open(cached_path, 'wb') as f:
                    f.write(data)
                foto_path = cached_path
            except HTTPException as e:
                print(f"[PDF] URL externa bloqueada (SSRF): {foto_url} — {e.detail}")
            except Exception as e:
                print(f"[PDF] Erro ao baixar imagem externa {foto_url}: {e}")
    else:
        # Caso 2: Caminho local (uploads do servidor)
        foto_path = foto_url.replace('/static/uploads/', 'uploads/')
    
    if foto_path and os.path.exists(foto_path):
        try:
            img = RLImage(foto_path)
            # Mantém aspect ratio
            aspect = img.imageWidth / img.imageHeight if img.imageHeight > 0 else 1
            if aspect > 1:
                img.drawWidth = max_width
                img.drawHeight = max_width / aspect
            else:
                img.drawHeight = max_height
                img.drawWidth = max_height * aspect
            return img
        except Exception as e:
            print(f"[PDF] Erro ao processar imagem {foto_path}: {e}")
    
    return Paragraph('<font color="#999999" size="7">Sem foto</font>', getSampleStyleSheet()['Normal'])


def build_items_table(itens, styles):
    """Constrói a tabela de itens do orçamento."""
    elements = []
    
    # Cabeçalho da tabela
    header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.white,
        fontName='Helvetica-Bold',
        leading=10,
    )
    cell_style = styles['ArcSmall']
    
    table_data = [[
        Paragraph('ITEM', header_style),
        Paragraph('IMAGEM', header_style),
        Paragraph('DESCRIÇÃO', header_style),
        Paragraph('QTDE', header_style),
        Paragraph('VALOR UNI.', header_style),
        Paragraph('VALOR TOTAL', header_style),
    ]]
    
    subtotal = 0
    for idx, item in enumerate(itens, 1):
        nome = esc(item.get('nome_externo', '') if item.get('is_externo') else item.get('nome', f'Produto #{item.get("produto_id", "?")}'))
        descricao = esc(item.get('descricao_externa', '') if item.get('is_externo') else '')
        local_inst = esc(item.get('local_instalacao', ''))

        display_name = nome
        if descricao:
            display_name += f'<br/><font size="6" color="#888">{descricao}</font>'
        if local_inst:
            display_name += f'<br/><font size="7" color="#2E2D2C">Local: {local_inst}</font>'
        personalizacao = esc(item.get('personalizacao_aplicada', ''))
        if personalizacao:
            display_name += f'<br/><font size="7" color="#2E2D2C">Personalização: {personalizacao}</font>'

        prazo_val = item.get('prazo_entrega_valor', '')
        prazo_uni = esc(item.get('prazo_entrega_unidade', ''))
        if prazo_val:
            display_name += f'<br/><font size="7" color="#2E2D2C">Prazo de Entrega: {prazo_val} {prazo_uni}</font>'
        
        qtd = item.get('quantidade', 1)
        preco_unit = item.get('preco_unitario_aplicado', 0)  # em centavos
        total_item = qtd * preco_unit
        subtotal += total_item
        
        img_cell = get_item_image(item)
        
        table_data.append([
            Paragraph(str(idx), cell_style),
            img_cell,
            Paragraph(display_name, cell_style),
            Paragraph(str(qtd), cell_style),
            Paragraph(f'R$ {preco_unit / 100:.2f}', cell_style),
            Paragraph(f'R$ {total_item / 100:.2f}', cell_style),
        ])
    
    col_widths = [1.2*cm, 2.5*cm, 7*cm, 1.5*cm, 2.5*cm, 2.8*cm]
    
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # Cabeçalho
        ('BACKGROUND', (0, 0), (-1, 0), WOOD),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Corpo
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, SAND]),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        # Alinhamentos
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # Item number
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),  # Imagem
        ('ALIGN', (3, 1), (3, -1), 'CENTER'),  # Qtd
        ('ALIGN', (4, 1), (-1, -1), 'RIGHT'),  # Valores
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 3*mm))
    
    # Tabela de totais
    frete = 25000  # R$ 250,00 em centavos
    total_geral = subtotal + frete
    
    totals_data = [
        ['', '', 'Total', f'R$', f'{subtotal / 100:.2f}'],
        ['', '', 'Desconto', '', '-'],
        ['', '', 'Frete RJ Capital', f'R$', f'{frete / 100:.2f}'],
        ['', '', 'TOTAL:', f'R$', f'{total_geral / 100:.2f}'],
    ]
    
    totals_table = Table(totals_data, colWidths=[7*cm, 3*cm, 3.5*cm, 1.2*cm, 2.8*cm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (2, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), NOBLE_GRAY),
        ('GRID', (2, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('BACKGROUND', (2, -1), (-1, -1), SAND),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    elements.append(totals_table)
    return elements, total_geral


def build_footer_info(styles, config=None, orcamento_data=None):
    """Seção de informações importantes e condições."""
    if not config:
        config = {}
    if not orcamento_data:
        orcamento_data = {}
        
    elements = []
    elements.append(Spacer(1, 6*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GOLD, spaceAfter=3*mm))
    
    elements.append(Paragraph('<b>Informações Importantes</b>', styles['ArcBold']))
    elements.append(Spacer(1, 2*mm))
    
    cond_pagamento = orcamento_data.get('condicoes_pagamento_selecionadas')
    if cond_pagamento:
        import json
        try:
            opcoes = json.loads(cond_pagamento)
            if isinstance(opcoes, list) and len(opcoes) > 0:
                cond_pagamento = " / ".join(opcoes)
            else:
                cond_pagamento = None
        except:
            cond_pagamento = None
    
    if not cond_pagamento:
        cond_pagamento = config.get('condicao_pagamento') or '5% à vista OU 3x sem juros. Em caso de construtoras e empreiteiras, 28 dias de faturamento.'
    cond_pagamento = esc(cond_pagamento)

    prazo = esc(config.get('prazo_entrega') or 'em casos de pronta entrega, até 7 dias úteis. No geral, de 30 a 40 dias úteis.')
    validade = esc(config.get('validade_orcamento') or '30 dias corridos.')
    garantia = esc(config.get('garantia_mobiliario') or '6 meses contra eventuais defeitos de fabricação.')
    observacoes = esc(config.get('observacoes_extras') or 'Peças cromadas em região litorânea não possuem garantia.\nEm caso de içamento, será de total responsabilidade do comprador.')
    
    info_lines = [
        f'<b>Condição de Pagamento:</b> {cond_pagamento}',
        f'<b>Prazo de entrega:</b> {prazo}',
        f'<b>Validade do Orçamento:</b> {validade}',
        f'<b>Garantia do Mobiliário:</b> {garantia}'
    ]
    
    for obs in observacoes.split('\n'):
        if obs.strip():
            info_lines.append(obs.strip())
    
    for line in info_lines:
        elements.append(Paragraph(line, styles['ArcSmall']))
        elements.append(Spacer(1, 1*mm))
    
    return elements


def build_vendor_footer(vendedor_data, styles):
    """Rodapé com dados do vendedor responsável."""
    elements = []
    elements.append(Spacer(1, 8*mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=WOOD, spaceAfter=4*mm))
    
    nome = esc(vendedor_data.get('nome', 'Vendedor'))
    contato = esc(vendedor_data.get('contato', ''))
    email = esc(vendedor_data.get('email', ''))
    
    vendor_text = f"""
    <font size="10" color="#2E2D2C"><b>{nome}</b></font><br/>
    <font size="8" color="#2E2D2C">{f'({contato})' if contato else ''}<br/>
    {email}</font>
    """
    
    elements.append(Paragraph(vendor_text, styles['ArcBody']))
    
    return elements


def generate_orcamento_pdf(orcamento_data: dict) -> str:
    """
    Gera o PDF do orçamento e retorna o caminho relativo do arquivo.
    
    Args:
        orcamento_data: dicionário com todos os dados do orçamento expandido
    
    Returns:
        URL relativa do PDF gerado (ex: /static/uploads/abc123.pdf)
    """
    os.makedirs("uploads", exist_ok=True)
    filename = f"orcamento_{orcamento_data['id']}_{uuid.uuid4().hex[:8]}.pdf"
    filepath = os.path.join("uploads", filename)
    
    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        leftMargin=1.5*cm,
        rightMargin=1.5*cm,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm,
    )
    
    styles = get_styles()
    elements = []
    
    # 1. Header corporativo
    elements.extend(build_header(styles))
    
    # 2. Dados do cliente
    elements.extend(build_client_section(orcamento_data, styles))
    
    # 3. Tabela de itens + totais
    items_elements, total = build_items_table(orcamento_data.get('itens', []), styles)
    elements.extend(items_elements)
    
    # 4. Informações importantes
    elements.extend(build_footer_info(styles, orcamento_data.get('config', {}), orcamento_data))
    
    # 5. Rodapé do vendedor
    elements.extend(build_vendor_footer({
        'nome': orcamento_data.get('vendedor_nome', ''),
        'contato': orcamento_data.get('vendedor_contato', ''),
        'email': orcamento_data.get('vendedor_email', ''),
    }, styles))
    
    doc.build(elements)
    
    return f"/static/uploads/{filename}"
