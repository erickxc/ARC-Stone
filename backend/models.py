# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    clientes = relationship("Cliente", back_populates="vendedor")
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
    preco_venda = Column(Integer, nullable=False) # em centavos
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
    nome_fantasia = Column(String, index=True, nullable=False)
    cpf_cnpj = Column(String, unique=True, index=True, nullable=True)
    nome_responsavel = Column(String, nullable=True)
    email = Column(String, nullable=True)
    contato = Column(String, nullable=True)
    status = Column(String, default="ativo", nullable=False)
    endereco_entrega = Column(String, nullable=True)
    endereco_faturamento = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    vendedor = relationship("Usuario", back_populates="clientes")
    orcamentos = relationship("Orcamento", back_populates="cliente")

class Orcamento(Base):
    __tablename__ = "orcamentos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    vendedor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tipo_orcamento = Column(String, nullable=False) # Venda, Locacao, Producao
    status = Column(String, nullable=False, default="Gerando orçamento") # Gerando orçamento, Planejando, Gerado, Negado, Aprovado
    anexo_url = Column(String, nullable=True) # PDF gerado
    data_aprovacao = Column(DateTime(timezone=True), nullable=True)
    condicoes_pagamento_selecionadas = Column(String, nullable=True) # JSON ou CSV de condicoes
    
    
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
    local_instalacao = Column(String, nullable=True)
    
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

    orcamento = relationship("Orcamento", back_populates="itens")
    produto = relationship("Produto")

class OrcamentoAnexo(Base):
    __tablename__ = "orcamento_anexos"

    id = Column(Integer, primary_key=True, index=True)
    orcamento_id = Column(Integer, ForeignKey("orcamentos.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    nome_original = Column(String, nullable=False)
    url = Column(String, nullable=False)
    extensao = Column(String, nullable=True)
    tamanho = Column(Integer, nullable=True)  # bytes
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

class CondicaoPagamento(Base):
    __tablename__ = "condicoes_pagamento"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    ativo = Column(Boolean, default=True)

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

