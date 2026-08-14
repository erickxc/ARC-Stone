# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Numeric
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
# pyrefly: ignore [missing-import]
from sqlalchemy.sql import func
from database import Base

class Fornecedor(Base):
    __tablename__ = "fornecedores"

    id = Column(Integer, primary_key=True, index=True)
    nome_fantasia = Column(String, index=True, nullable=False)
    cnpj = Column(String, unique=True, index=True, nullable=True)
    contato = Column(String, nullable=True)
    email = Column(String, nullable=True)
    telefone = Column(String, nullable=True)
    endereco = Column(String, nullable=True)
    observacoes = Column(String, nullable=True)
    status = Column(String, default="ativo", nullable=False)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    produtos = relationship("Produto", back_populates="fornecedor")

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)
    contato = Column(String, nullable=True)  # Telefone do funcionário (exibido no PDF)
    ativo = Column(Boolean, default=True)
    totp_secret = Column(String, nullable=True)
    mfa_enabled = Column(Boolean, default=False)
    reset_token_version = Column(Integer, nullable=False, default=0)  # incrementa a cada uso do token de reset, invalidando os anteriores
    sessao_token_version = Column(Integer, nullable=False, default=0)  # incrementa no logout e na troca de senha, invalidando os refresh tokens emitidos
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Cliente tem 3 FKs para usuarios (dono, criado_por, editado_por) — precisa desambiguar.
    clientes = relationship("Cliente", back_populates="vendedor", foreign_keys="Cliente.usuario_id")
    orcamentos = relationship("Orcamento", back_populates="vendedor")

class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    tipo = Column(String, nullable=True) # Ex: cadeira, mesa
    material = Column(String, nullable=True)
    cor = Column(String, nullable=True)
    descricao = Column(String, nullable=True)
    foto_url = Column(String, nullable=True) # Caminho relativo da foto no servidor
    quantidade_estoque = Column(Integer, default=0, nullable=False)
    quantidade_retida = Column(Integer, default=0, nullable=False)
    preco_custo = Column(Integer, nullable=False) # em centavos
    preco_venda = Column(Integer, nullable=False) # em centavos — preço "reto" (acabamento base)
    # Preço quando vendido com acabamento "trabalhado" (borda perfilada, acabamento extra).
    # Nulo = a pedra só é vendida no acabamento reto.
    preco_venda_trabalhado = Column(Integer, nullable=True) # em centavos
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"), nullable=True)
    dimensionamento = Column(String, nullable=True) # Legado, manter para compatibilidade temporária
    comprimento = Column(Float, nullable=True)
    largura = Column(Float, nullable=True)
    altura = Column(Float, nullable=True)
    diametro = Column(Float, nullable=True)
    peso_liquido = Column(Float, nullable=True)
    peso_bruto = Column(Float, nullable=True)
    comodos = Column(String, nullable=True) # Novo: Sala, Quarto
    is_catalogo = Column(Boolean, default=False)
    personalizacao = Column(String, nullable=True)
    classificacao_fiscal = Column(String, nullable=True)
    observacoes = Column(String, nullable=True)
    ativo = Column(Boolean, default=True)
    estoque_minimo = Column(Integer, default=5)
    
    fornecedor = relationship("Fornecedor", back_populates="produtos")
    
    version_id = Column(Integer, nullable=False, default=1)
    __mapper_args__ = { "version_id_col": version_id }

class MovimentacaoEstoque(Base):
    __tablename__ = "movimentacoes_estoque"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, index=True, nullable=False)
    usuario_id = Column(Integer, index=True, nullable=False)
    tipo = Column(String, nullable=False) # 'ENTRADA' ou 'SAIDA'
    quantidade = Column(Integer, nullable=False)
    justificativa = Column(String, nullable=False)
    data_movimentacao = Column(DateTime(timezone=True), server_default=func.now())

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False) # Vendedor Dono
    # Nome de exibição do cliente. É DERIVADO: o router o recalcula a partir de
    # nome+sobrenome (PF) ou razao_social (PJ) em toda escrita. Não é campo de entrada.
    # Motivo de manter a coluna: é lida em ~12 pontos (PDF, portal, kanban, calendário);
    # trocar todos por lógica tipo_pessoa-aware teria blast radius alto sem ganho.
    nome_fantasia = Column(String, index=True, nullable=False)
    tipo_pessoa = Column(String, nullable=False, default="juridica", server_default="juridica")  # 'fisica' | 'juridica'
    nome = Column(String, nullable=True)          # PF
    sobrenome = Column(String, nullable=True)     # PF
    razao_social = Column(String, nullable=True)  # PJ
    cpf_cnpj = Column(String, unique=True, index=True, nullable=True)
    nome_responsavel = Column(String, nullable=True)
    email = Column(String, nullable=True)
    contato = Column(String, nullable=True)  # telefone principal
    telefone_secundario = Column(String, nullable=True)
    status = Column(String, default="ativo", nullable=False)
    # Endereço estruturado. Os campos de texto livre abaixo continuam existindo: o PDF e o
    # portal já os consomem, e migrá-los está fora do escopo desta entrega.
    cep = Column(String, nullable=True)
    numero = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    estado = Column(String(2), nullable=True)
    endereco_entrega = Column(String, nullable=True)
    endereco_faturamento = Column(String, nullable=True)
    # Relacionamento comercial
    carteira = Column(Boolean, default=False, nullable=False, server_default="false")  # cliente recorrente
    indicado_por = Column(String, nullable=True)  # preenchido = veio por indicação
    profissional_tipo = Column(String, nullable=True)  # arquiteto, engenheiro, ...
    data_nascimento = Column(DateTime(timezone=True), nullable=True)  # gancho de recompra
    origem_contato = Column(String, nullable=True)  # como chegou: Instagram, obra vizinha, Google...
    preferencia_contato = Column(String, nullable=True)  # whatsapp | ligacao | email
    # Autoria: criado_por nunca muda; editado_por/em são reescritos a cada update.
    criado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    editado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    editado_em = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vendedor = relationship("Usuario", back_populates="clientes", foreign_keys=[usuario_id])
    criado_por = relationship("Usuario", foreign_keys=[criado_por_id])
    editado_por = relationship("Usuario", foreign_keys=[editado_por_id])
    orcamentos = relationship("Orcamento", back_populates="cliente")

class Orcamento(Base):
    __tablename__ = "orcamentos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    vendedor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tipo_orcamento = Column(String, nullable=False)  # Obra, Peça, Projeto, Externo — o QUE se vende
    # COMO a venda acontece, ortogonal ao tipo: 'venda_direta' (cliente presente, paga na
    # hora) ou 'orcamento_formal' (proposta que vai ao portal para aprovação do cliente).
    modalidade = Column(String, nullable=False, default="orcamento_formal", server_default="orcamento_formal")
    status = Column(String, nullable=False, default="Gerando orçamento") # Gerando orçamento, Gerando projeto, Projeto enviado, Ajuste solicitado, Orçamento negado, Aprovado, Em produção, Entrega, Concluído, Devolvido, Faturado
    anexo_url = Column(String, nullable=True) # PDF gerado
    data_aprovacao = Column(DateTime(timezone=True), nullable=True)
    condicoes_pagamento_selecionadas = Column(String, nullable=True) # JSON ou CSV de condicoes
    # Desconto de fechamento, aplicado sobre a soma das linhas ("faço por 12 mil").
    desconto_global_centavos = Column(Integer, nullable=False, default=0, server_default="0")
    
    
    # Arquiteto
    arquiteto_nome = Column(String, nullable=True)
    arquiteto_contato = Column(String, nullable=True)
    
    # Controle de Locação/Produção
    data_entrega = Column(DateTime(timezone=True), nullable=True)
    prazo_locacao_valor = Column(Integer, nullable=True)
    prazo_locacao_unidade = Column(String, nullable=True) # "dias" ou "meses"
    data_fim_locacao = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # CNPJ da empresa emissora escolhido na aprovação
    cnpj_faturamento = Column(String, nullable=True)

    # Portal do cliente — link mágico e decisão registrada pelo cliente final.
    portal_token_version = Column(Integer, nullable=False, default=0, server_default="0")
    decisao_cliente = Column(String, nullable=True)  # 'aprovado' | 'recusado' | None
    decisao_cliente_motivo = Column(String, nullable=True)  # obrigatório quando recusado
    decisao_cliente_nome = Column(String, nullable=True)  # nome digitado por quem decidiu
    decisao_cliente_em = Column(DateTime(timezone=True), nullable=True)

    # Projeto de origem (importado de um software de arquitetura), quando houver
    projeto_id = Column(Integer, ForeignKey("projetos.id"), nullable=True)

    cliente = relationship("Cliente", back_populates="orcamentos")
    vendedor = relationship("Usuario", back_populates="orcamentos")
    itens = relationship("OrcamentoItem", back_populates="orcamento", cascade="all, delete-orphan")
    anexos = relationship("OrcamentoAnexo", back_populates="orcamento", cascade="all, delete-orphan")
    projeto = relationship("Projeto")

class OrcamentoItem(Base):
    __tablename__ = "orcamento_itens"

    id = Column(Integer, primary_key=True, index=True)
    orcamento_id = Column(Integer, ForeignKey("orcamentos.id"), nullable=False)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=True) # Nulo se for item externo
    quantidade = Column(Integer, nullable=False)
    preco_unitario_aplicado = Column(Integer, nullable=False) # Congelado no momento da emissão
    # Legado: substituído por local_id (catálogo Local). Mantido nullable porque o PDF e o
    # portal já leem esse texto em orçamentos antigos — a exibição faz fallback.
    local_instalacao = Column(String, nullable=True)
    local_id = Column(Integer, ForeignKey("locais.id"), nullable=True)
    # Sequencial dentro do orçamento (01, 02...), gerado no backend. Nullable por causa
    # dos itens criados antes desta coluna existir.
    codigo_item = Column(Integer, nullable=True)
    # Medidas em metros. area_m2 é SEMPRE calculada no backend (comprimento × largura);
    # o frontend só mostra prévia enquanto o usuário digita.
    comprimento_m = Column(Numeric(10, 2), nullable=True)
    largura_m = Column(Numeric(10, 2), nullable=True)
    area_m2 = Column(Numeric(10, 2), nullable=True)
    # Unidade congelada na inserção, junto com o preço: decide a fórmula do total da linha.
    unidade_medida = Column(String, nullable=False, default="un", server_default="un")

    # Suporte a itens de Fornecedores Externos (não estocados)
    is_externo = Column(Boolean, default=False)
    nome_externo = Column(String, nullable=True)
    descricao_externa = Column(String, nullable=True)
    fornecedor_externo = Column(String, nullable=True)
    personalizacao_aplicada = Column(String, nullable=True)
    foto_externa_url = Column(String, nullable=True)
    
    # Prazo de entrega
    prazo_entrega_valor = Column(Integer, nullable=True)
    prazo_entrega_unidade = Column(String, nullable=True) # "dias" ou "meses"

    # Item do projeto importado que originou esta linha (proveniência), quando houver
    projeto_item_id = Column(Integer, ForeignKey("projeto_itens.id"), nullable=True)

    # Item de serviço (catálogo de serviços), alternativa a produto_id — exatamente um dos
    # dois (ou is_externo) deve estar preenchido, validado em schemas.OrcamentoItemCreate.
    servico_id = Column(Integer, ForeignKey("servicos.id"), nullable=True)
    # Componente específico do serviço, quando o serviço é composto. Cada componente
    # incluído vira uma LINHA própria — sem hierarquia pai/filho, porque o PDF e o portal
    # são planos e um agrupamento só no frontend viraria mentira no primeiro reload.
    servico_componente_id = Column(Integer, ForeignKey("servico_componentes.id"), nullable=True)
    # Compartilhado pelas linhas geradas de um mesmo serviço composto, para agrupar visualmente.
    grupo_id = Column(String, nullable=True, index=True)

    orcamento = relationship("Orcamento", back_populates="itens")
    produto = relationship("Produto")
    servico = relationship("Servico")
    servico_componente = relationship("ServicoComponente")
    local = relationship("Local")

class OrcamentoAnexo(Base):
    __tablename__ = "orcamento_anexos"

    id = Column(Integer, primary_key=True, index=True)
    orcamento_id = Column(Integer, ForeignKey("orcamentos.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    nome_original = Column(String, nullable=False)
    url = Column(String, nullable=False)
    extensao = Column(String, nullable=True)
    tamanho = Column(Integer, nullable=True)  # bytes
    # Liberação explícita: anexos internos nunca ficam públicos por acidente.
    visivel_cliente = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orcamento = relationship("Orcamento", back_populates="anexos")
    usuario = relationship("Usuario")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True) # Quem realizou a ação
    vendedor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True) # Dono da entidade afetada (para filtrar)
    acao = Column(String, nullable=False) # Ex: MUDOU_STATUS, CRIOU, EDITOU, DELETOU
    detalhes = Column(String, nullable=False) # Descrição da ação
    entidade = Column(String, nullable=True) # Ex: Orcamento
    entidade_id = Column(Integer, nullable=True) # ID do Orçamento
    ip = Column(String, nullable=True) # IP do cliente que realizou a ação
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    usuario = relationship("Usuario", foreign_keys=[usuario_id])
    vendedor = relationship("Usuario", foreign_keys=[vendedor_id])

class OrcamentoConfig(Base):
    __tablename__ = "orcamento_config"

    id = Column(Integer, primary_key=True, index=True)
    condicao_pagamento = Column(String, nullable=True)
    prazo_entrega = Column(String, nullable=True)
    validade_orcamento = Column(String, nullable=True)
    garantia_mobiliario = Column(String, nullable=True)
    observacoes_extras = Column(String, nullable=True)
    # Empresas emissoras (CNPJ escolhido na aprovação do orçamento)
    empresa1_nome = Column(String, nullable=True)
    empresa1_cnpj = Column(String, nullable=True)
    empresa2_nome = Column(String, nullable=True)
    empresa2_cnpj = Column(String, nullable=True)
    # Co-marca: nome do escritorio exibido ao lado do ARC (lockup "ARC / Stone").
    organizacao_nome = Column(String, nullable=True)

class CatalogoSimplesMixin:
    """Colunas comuns aos catálogos configuráveis pelo usuário (Configurações do orçamento).

    `built_in` marca os registros semeados pelo sistema: podem ser desativados e reordenados,
    nunca excluídos — a exclusão é recusada no router com 400.
    """
    nome = Column(String, nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)
    ordem = Column(Integer, nullable=False, default=0)
    built_in = Column(Boolean, default=False, nullable=False)


class CondicaoPagamento(CatalogoSimplesMixin, Base):
    """Condição de parcelamento (ex: "40% entrada + 3x")."""
    __tablename__ = "condicoes_pagamento"

    id = Column(Integer, primary_key=True, index=True)


class TipoPagamento(CatalogoSimplesMixin, Base):
    """Categoria macro do pagamento: Cartão, Dinheiro, Crediário, Cheque, Pix.

    `exige_forma` liga a segunda etapa da cascata — só Cartão se desdobra em Crédito/Débito.
    """
    __tablename__ = "tipos_pagamento"

    id = Column(Integer, primary_key=True, index=True)
    exige_forma = Column(Boolean, default=False, nullable=False)

    formas = relationship("FormaPagamento", back_populates="tipo", cascade="all, delete-orphan")


class FormaPagamento(CatalogoSimplesMixin, Base):
    """Sub-opção de um TipoPagamento (Crédito/Débito sob Cartão)."""
    __tablename__ = "formas_pagamento"

    id = Column(Integer, primary_key=True, index=True)
    tipo_pagamento_id = Column(Integer, ForeignKey("tipos_pagamento.id"), nullable=False, index=True)

    tipo = relationship("TipoPagamento", back_populates="formas")


class Local(CatalogoSimplesMixin, Base):
    """Local de instalação do item (Banheiro, Cozinha, Área externa...)."""
    __tablename__ = "locais"

    id = Column(Integer, primary_key=True, index=True)


class MotivoPerdaAvaria(CatalogoSimplesMixin, Base):
    """Catálogo que alimenta o seletor de motivo em Perdas e Avarias.

    `PerdaAvaria.motivo` continua gravando texto (o slug), não FK — trocar o tipo da coluna
    quebraria filtros/relatórios existentes sem ganho proporcional.
    """
    __tablename__ = "motivos_perda_avaria"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, nullable=False, unique=True, index=True)

class Projeto(Base):
    """Projeto importado de um software de arquitetura (ex: SketchUp). Independente do orçamento
    até que um vendedor selecione e valide os itens na criação/edição de um orçamento."""
    __tablename__ = "projetos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False) # Quem importou
    origem = Column(String, nullable=False) # 'sketchup', 'manual_csv', ...
    origem_meta = Column(String, nullable=True) # Metadados livres da origem (nome do arquivo, versão, etc.)
    # Chave de proveniência do projeto no sistema de origem. A combinação é
    # protegida por índice parcial no startup para manter legado/CSV compatível.
    origem_ref = Column(String, nullable=True, index=True)
    origem_rev = Column(String, nullable=True)
    origem_status = Column(String, nullable=True)  # 'rascunho', 'finalizado' ou nulo
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cliente = relationship("Cliente")
    usuario = relationship("Usuario")
    itens = relationship("ProjetoItem", back_populates="projeto", cascade="all, delete-orphan")

class ProjetoItem(Base):
    __tablename__ = "projeto_itens"

    id = Column(Integer, primary_key=True, index=True)
    projeto_id = Column(Integer, ForeignKey("projetos.id"), nullable=False, index=True)
    nome = Column(String, nullable=False)
    quantidade = Column(Integer, nullable=False, default=1)
    material = Column(String, nullable=True)
    comprimento = Column(Float, nullable=True)
    largura = Column(Float, nullable=True)
    altura = Column(Float, nullable=True)
    referencia_externa = Column(String, nullable=True, index=True) # Ex: GUID do componente na origem
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=True) # Sugestão de casamento com o catálogo
    preco_sugerido_centavos = Column(Integer, nullable=True)
    observacoes = Column(String, nullable=True)

    projeto = relationship("Projeto", back_populates="itens")
    produto = relationship("Produto")

class LancamentoFinanceiro(Base):
    """Ledger unificado de contas a pagar/receber. Entradas ligadas a um orçamento são
    criadas automaticamente na aprovação (ver routers/orcamentos.py); lançamentos manuais
    (tipicamente saídas) são criados pela aba Financeiro."""
    __tablename__ = "lancamentos_financeiros"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String, nullable=False)  # 'ENTRADA' ou 'SAIDA'
    descricao = Column(String, nullable=False)
    categoria = Column(String, nullable=True)
    valor = Column(Integer, nullable=False)  # em centavos
    status = Column(String, nullable=False, default="pendente")  # 'pendente' ou 'pago'
    data_vencimento = Column(DateTime(timezone=True), nullable=False)
    data_pagamento = Column(DateTime(timezone=True), nullable=True)
    automatico = Column(Boolean, nullable=False, default=False)  # gerado ao aprovar orçamento
    # ON DELETE SET NULL: excluir o orçamento não pode falhar por causa de um lançamento já
    # pago vinculado a ele — o lançamento fica como histórico órfão, só perde a referência.
    orcamento_id = Column(Integer, ForeignKey("orcamentos.id", ondelete="SET NULL"), nullable=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orcamento = relationship("Orcamento")
    usuario = relationship("Usuario")

class Servico(Base):
    """Catálogo de serviços (ex: instalação de bancada), separado do catálogo de Produto."""
    __tablename__ = "servicos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    descricao = Column(String, nullable=True)
    preco_padrao = Column(Integer, nullable=False)  # em centavos
    tempo_medio_valor = Column(Integer, nullable=False)
    tempo_medio_unidade = Column(String, nullable=False)  # "horas" ou "dias"
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    componentes = relationship(
        "ServicoComponente", back_populates="servico",
        cascade="all, delete-orphan", order_by="ServicoComponente.ordem",
    )


class ServicoComponente(Base):
    """Peça que compõe um serviço (ex: "Bancada Banheiro" = Bancada + Saia + Front + Ilharga).

    Cada componente tem unidade própria porque a marmoraria mede diferente em cada peça:
    bancada em m², saia/rodabase em metro linear, cuba em unidade. Essa unidade é copiada
    para o item do orçamento e decide a fórmula do total da linha.

    Quando o serviço tem componentes, `Servico.preco_padrao` vira informativo: o preço real
    é a soma dos componentes efetivamente incluídos naquele orçamento.
    """
    __tablename__ = "servico_componentes"

    id = Column(Integer, primary_key=True, index=True)
    servico_id = Column(Integer, ForeignKey("servicos.id"), nullable=False, index=True)
    nome = Column(String, nullable=False)
    obrigatorio = Column(Boolean, default=False, nullable=False)
    unidade_medida = Column(String, nullable=False, default="m2")  # 'm2' | 'linear' | 'un'
    preco_unitario = Column(Integer, nullable=True)  # centavos
    ativo = Column(Boolean, default=True, nullable=False)
    ordem = Column(Integer, nullable=False, default=0)

    servico = relationship("Servico", back_populates="componentes")

class Venda(Base):
    """Entidade própria, distinta de Orcamento. Criada explicitamente ao converter um
    orçamento aprovado (ver routers/orcamentos.py) — não é derivada de status."""
    __tablename__ = "vendas"

    id = Column(Integer, primary_key=True, index=True)
    orcamento_id = Column(Integer, ForeignKey("orcamentos.id"), unique=True, nullable=False)
    vendedor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    valor_total = Column(Integer, nullable=False)  # centavos, congelado na conversão
    # Pagamento mora aqui, não no Orçamento: só é definitivo quando existe venda — nas duas
    # modalidades. No Orçamento seriam 3 colunas nulas durante todo o ciclo da proposta.
    tipo_pagamento_id = Column(Integer, ForeignKey("tipos_pagamento.id"), nullable=True)
    forma_pagamento_id = Column(Integer, ForeignKey("formas_pagamento.id"), nullable=True)
    condicao_pagamento_id = Column(Integer, ForeignKey("condicoes_pagamento.id"), nullable=True)
    data_venda = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orcamento = relationship("Orcamento")
    vendedor = relationship("Usuario")
    tipo_pagamento = relationship("TipoPagamento")
    forma_pagamento = relationship("FormaPagamento")
    condicao_pagamento = relationship("CondicaoPagamento")

class EtapaProducao(CatalogoSimplesMixin, Base):
    """Etapa da esteira de produção (Projeto, Em Análise, Aguardando material, Corte...).

    É um catálogo configurável como os demais: a marmoraria ajusta as etapas ao próprio
    processo. `ordem` define a sequência da esteira, não só a exibição.
    """
    __tablename__ = "etapas_producao"

    id = Column(Integer, primary_key=True, index=True)
    # Etapa final: ao chegar aqui a ordem sai da esteira ativa.
    is_final = Column(Boolean, default=False, nullable=False, server_default="false")


class OrdemProducao(Base):
    """Acompanha o que foi vendido enquanto passa pela oficina.

    Nasce automaticamente junto com a Venda — vendeu, tem que produzir. Fica separada da
    Venda porque o ciclo é outro: a venda é um fato consumado, a ordem é um trabalho que
    anda por etapas e pode voltar (peça quebrou no corte, refaz).
    """
    __tablename__ = "ordens_producao"

    id = Column(Integer, primary_key=True, index=True)
    venda_id = Column(Integer, ForeignKey("vendas.id"), unique=True, nullable=False, index=True)
    etapa_id = Column(Integer, ForeignKey("etapas_producao.id"), nullable=False, index=True)
    responsavel_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    observacoes = Column(String, nullable=True)
    previsao_entrega = Column(DateTime(timezone=True), nullable=True)
    iniciada_em = Column(DateTime(timezone=True), server_default=func.now())
    concluida_em = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    venda = relationship("Venda")
    etapa = relationship("EtapaProducao")
    responsavel = relationship("Usuario")
    historico = relationship(
        "OrdemProducaoEtapa", back_populates="ordem",
        cascade="all, delete-orphan", order_by="OrdemProducaoEtapa.registrado_em",
    )


class OrdemProducaoEtapa(Base):
    """Trilha de por onde a ordem passou — sem isso não dá para saber onde a peça travou."""
    __tablename__ = "ordem_producao_etapas"

    id = Column(Integer, primary_key=True, index=True)
    ordem_id = Column(Integer, ForeignKey("ordens_producao.id"), nullable=False, index=True)
    etapa_id = Column(Integer, ForeignKey("etapas_producao.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    observacao = Column(String, nullable=True)
    registrado_em = Column(DateTime(timezone=True), server_default=func.now())

    ordem = relationship("OrdemProducao", back_populates="historico")
    etapa = relationship("EtapaProducao")
    usuario = relationship("Usuario")


class PerdaAvaria(Base):
    """Registro de perda/avaria de estoque. Ao ser criada, debita quantidade_estoque do
    Produto afetado via a mesma rotina de estoque.py usada para movimentações manuais."""
    __tablename__ = "perdas_avarias"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    quantidade = Column(Integer, nullable=False)
    motivo = Column(String, nullable=False)  # ver schemas.MOTIVOS_PERDA_AVARIA
    justificativa = Column(String, nullable=False)
    data_ocorrencia = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    produto = relationship("Produto")
    usuario = relationship("Usuario")

class Equipamento(Base):
    """Cadastro de máquinas/ferramentas da marmoraria (cortadeira, policorte, etc.)."""
    __tablename__ = "equipamentos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    tipo = Column(String, nullable=True)
    estado = Column(String, default="operante", nullable=False)  # operante, manutencao, inativo
    numero_serie = Column(String, nullable=True)
    data_aquisicao = Column(DateTime(timezone=True), nullable=True)
    observacoes = Column(String, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MateriaPrima(Base):
    """Inventário de matéria-prima (ex: chapas de granito/mármore antes de virarem produto
    acabado) — entidade própria, separada do catálogo de Produto."""
    __tablename__ = "materias_primas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    tipo_material = Column(String, nullable=True)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"), nullable=True)
    unidade_medida = Column(String, nullable=False, default="m2")  # m2, un, kg
    quantidade_estoque = Column(Numeric(10, 2), default=0, nullable=False)
    preco_custo = Column(Integer, nullable=True)  # em centavos
    comprimento = Column(Float, nullable=True)
    largura = Column(Float, nullable=True)
    espessura = Column(Float, nullable=True)
    observacoes = Column(String, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    fornecedor = relationship("Fornecedor")

class ApiKey(Base):
    """Chave de API para autenticação máquina-a-máquina (ex: extensão do SketchUp fazendo push de projetos)."""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nome = Column(String, nullable=False)
    prefixo = Column(String, nullable=False, index=True)
    hash_chave = Column(String, nullable=False, unique=True, index=True)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    usuario = relationship("Usuario")

