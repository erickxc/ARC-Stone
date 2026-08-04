from pydantic import BaseModel, EmailStr, field_validator, Field
from typing import List, Optional
from datetime import datetime
import re


def validar_complexidade_senha(v: str) -> str:
    """Regra única de força de senha — usada tanto na criação de usuário quanto na
    redefinição de senha (POST /auth/reset-password), pra não deixar o reset aceitar uma
    senha mais fraca do que a criação de conta permitiria."""
    if len(v) < 8: raise ValueError('Minimo 8 caracteres.')
    if not re.search(r"[A-Z]", v): raise ValueError('Requer maiúscula.')
    if not re.search(r"[a-z]", v): raise ValueError('Requer minúscula.')
    if not re.search(r"\d", v): raise ValueError('Requer número.')
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v): raise ValueError('Requer caractere especial.')
    return v


class UsuarioCreate(BaseModel):
    nome: str = Field(..., max_length=150, pattern=r"^[^<>]*$")
    email: EmailStr
    password: str
    role: str
    contato: Optional[str] = None

    @field_validator('password')
    def password_complexity(cls, v):
        return validar_complexidade_senha(v)

    @field_validator('role')
    def validate_role(cls, v):
        allowed_roles = ['admin', 'vendedor', 'estoquista']
        if v not in allowed_roles: raise ValueError(f'Role inválida: {allowed_roles}')
        return v

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    contato: Optional[str] = None

class UsuarioOut(BaseModel):
    id: int
    nome: str
    email: str
    role: str
    contato: Optional[str] = None
    ativo: bool
    mfa_enabled: bool
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class FornecedorBase(BaseModel):
    nome_fantasia: str = Field(..., max_length=150, pattern=r"^[^<>]*$")
    cnpj: Optional[str] = None
    contato: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    observacoes: Optional[str] = None
    status: Optional[str] = "ativo"
    ativo: Optional[bool] = True

class FornecedorCreate(FornecedorBase):
    pass

class FornecedorOut(FornecedorBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class ProdutoCreate(BaseModel):
    nome: str
    tipo: Optional[str] = None
    material: Optional[str] = None
    cor: Optional[str] = None
    descricao: Optional[str] = None
    foto_url: Optional[str] = None
    quantidade_estoque: int = 0
    quantidade_retida: int = 0
    preco_custo: int 
    preco_venda: int 
    fornecedor_id: Optional[int] = None
    dimensionamento: Optional[str] = None
    comprimento: Optional[float] = None
    largura: Optional[float] = None
    altura: Optional[float] = None
    diametro: Optional[float] = None
    peso_liquido: Optional[float] = None
    peso_bruto: Optional[float] = None
    comodos: Optional[str] = None
    is_catalogo: Optional[bool] = False
    personalizacao: Optional[str] = None
    classificacao_fiscal: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = True
    estoque_minimo: int = 5

class ProdutoOut(ProdutoCreate):
    id: int
    version_id: int
    class Config:
        from_attributes = True

class ProdutoUpdate(BaseModel):
    nome: Optional[str] = None
    tipo: Optional[str] = None
    material: Optional[str] = None
    cor: Optional[str] = None
    descricao: Optional[str] = None
    foto_url: Optional[str] = None
    quantidade_estoque: Optional[int] = None
    quantidade_retida: Optional[int] = None
    preco_custo: Optional[int] = None
    preco_venda: Optional[int] = None
    fornecedor_id: Optional[int] = None
    dimensionamento: Optional[str] = None
    comprimento: Optional[float] = None
    largura: Optional[float] = None
    altura: Optional[float] = None
    diametro: Optional[float] = None
    peso_liquido: Optional[float] = None
    peso_bruto: Optional[float] = None
    comodos: Optional[str] = None
    is_catalogo: Optional[bool] = None
    personalizacao: Optional[str] = None
    classificacao_fiscal: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = None
    estoque_minimo: Optional[int] = None

class MovimentacaoCreate(BaseModel):
    quantidade: int
    justificativa: str

class ClienteCreate(BaseModel):
    nome_fantasia: str
    cpf_cnpj: Optional[str] = None
    nome_responsavel: Optional[str] = None
    email: Optional[EmailStr] = None
    contato: Optional[str] = None
    endereco_entrega: Optional[str] = None
    endereco_faturamento: Optional[str] = None
    status: Optional[str] = "ativo"

class ClienteOut(ClienteCreate):
    id: int
    usuario_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class OrcamentoItemCreate(BaseModel):
    produto_id: Optional[int] = None
    quantidade: int
    preco_unitario_aplicado: int
    local_instalacao: Optional[str] = None
    is_externo: bool = False
    nome_externo: Optional[str] = None
    descricao_externa: Optional[str] = None
    fornecedor_externo: Optional[str] = None
    foto_externa_url: Optional[str] = None
    personalizacao_aplicada: Optional[str] = None
    prazo_entrega_valor: Optional[int] = None
    prazo_entrega_unidade: Optional[str] = None
    projeto_item_id: Optional[int] = None

class OrcamentoItemOut(OrcamentoItemCreate):
    id: int
    orcamento_id: int
    nome: Optional[str] = None
    foto_url: Optional[str] = None
    class Config:
        from_attributes = True

class OrcamentoCreate(BaseModel):
    cliente_id: int
    tipo_orcamento: str  # Venda, Locacao, Producao
    vendedor_id: Optional[int] = None  # Admin pode selecionar; vendedor ignora
    
    # Opcionais
    arquiteto_nome: Optional[str] = None
    arquiteto_contato: Optional[str] = None
    data_entrega: Optional[datetime] = None
    prazo_locacao_valor: Optional[int] = None
    prazo_locacao_unidade: Optional[str] = None
    condicoes_pagamento_selecionadas: Optional[str] = None
    itens: List[OrcamentoItemCreate]
    projeto_id: Optional[int] = None

# Schema básico para listagem no Kanban (com dados expandidos)
class OrcamentoOut(BaseModel):
    id: int
    cliente_id: int
    vendedor_id: int
    tipo_orcamento: str
    status: str
    anexo_url: Optional[str] = None
    created_at: datetime
    data_aprovacao: Optional[datetime] = None
    data_entrega: Optional[datetime] = None
    prazo_locacao_valor: Optional[int] = None
    prazo_locacao_unidade: Optional[str] = None
    data_fim_locacao: Optional[datetime] = None
    arquiteto_nome: Optional[str] = None
    arquiteto_contato: Optional[str] = None
    condicoes_pagamento_selecionadas: Optional[str] = None
    cnpj_faturamento: Optional[str] = None
    projeto_id: Optional[int] = None
    itens: List[OrcamentoItemOut]
    # Campos calculados / expandidos
    cliente_nome: Optional[str] = None
    cliente_status: Optional[str] = None
    vendedor_nome: Optional[str] = None
    valor_total: Optional[int] = None  # em centavos
    pendencias: List[str] = []
    
    class Config:
        from_attributes = True

# Schema detalhado para a página de detalhes do orçamento
class OrcamentoDetailOut(BaseModel):
    id: int
    cliente_id: int
    vendedor_id: int
    tipo_orcamento: str
    status: str
    anexo_url: Optional[str] = None
    created_at: datetime
    itens: List[OrcamentoItemOut]
    # Dados expandidos do Cliente
    cliente_nome: Optional[str] = None
    cliente_status: Optional[str] = None
    cliente_cpf_cnpj: Optional[str] = None
    cliente_responsavel: Optional[str] = None
    cliente_email: Optional[str] = None
    cliente_contato: Optional[str] = None
    cliente_endereco: Optional[str] = None
    # Dados expandidos do Vendedor
    vendedor_nome: Optional[str] = None
    vendedor_email: Optional[str] = None
    vendedor_contato: Optional[str] = None
    valor_total: Optional[int] = None
    data_aprovacao: Optional[datetime] = None
    data_entrega: Optional[datetime] = None
    prazo_locacao_valor: Optional[int] = None
    prazo_locacao_unidade: Optional[str] = None
    data_fim_locacao: Optional[datetime] = None
    arquiteto_nome: Optional[str] = None
    arquiteto_contato: Optional[str] = None
    cnpj_faturamento: Optional[str] = None
    projeto_id: Optional[int] = None
    pendencias: List[str] = []

    class Config:
        from_attributes = True

class OrcamentoAnexoOut(BaseModel):
    id: int
    orcamento_id: int
    nome_original: str
    url: str
    extensao: Optional[str] = None
    tamanho: Optional[int] = None
    created_at: datetime
    usuario_nome: Optional[str] = None  # Campo expandido

    class Config:
        from_attributes = True

class AuditLogOut(BaseModel):
    id: int
    usuario_id: Optional[int] = None
    vendedor_id: Optional[int] = None
    acao: str
    detalhes: str
    entidade: Optional[str] = None
    entidade_id: Optional[int] = None
    ip: Optional[str] = None
    created_at: datetime
    usuario_nome: Optional[str] = None # Campo expandido
    
    class Config:
        from_attributes = True

class OrcamentoConfigBase(BaseModel):
    condicao_pagamento: Optional[str] = None
    prazo_entrega: Optional[str] = None
    validade_orcamento: Optional[str] = None
    garantia_mobiliario: Optional[str] = None
    observacoes_extras: Optional[str] = None
    empresa1_nome: Optional[str] = None
    empresa1_cnpj: Optional[str] = None
    empresa2_nome: Optional[str] = None
    empresa2_cnpj: Optional[str] = None

class OrcamentoConfigUpdate(OrcamentoConfigBase):
    pass

class OrcamentoConfigOut(OrcamentoConfigBase):
    id: int
    class Config:
        from_attributes = True

class CondicaoPagamentoBase(BaseModel):
    nome: str
    ativo: Optional[bool] = True

class CondicaoPagamentoCreate(CondicaoPagamentoBase):
    pass

class CondicaoPagamentoUpdate(BaseModel):
    nome: Optional[str] = None
    ativo: Optional[bool] = None

class CondicaoPagamentoOut(CondicaoPagamentoBase):
    id: int
    class Config:
        from_attributes = True


class OrcamentoCondicaoPagamentoUpdate(BaseModel):
    condicao_pagamento: str


# --- Projetos (integração com softwares de arquitetura, ex: SketchUp) ---

PROJETO_ORIGENS_PERMITIDAS = ["sketchup", "manual_csv", "stone"]

class ProjetoItemBase(BaseModel):
    nome: str = Field(..., max_length=200)
    quantidade: int = Field(..., ge=1)
    material: Optional[str] = None
    comprimento: Optional[float] = None
    largura: Optional[float] = None
    altura: Optional[float] = None
    referencia_externa: Optional[str] = None
    preco_sugerido_centavos: Optional[int] = Field(None, ge=0)
    observacoes: Optional[str] = None

class ProjetoItemCreate(ProjetoItemBase):
    produto_id: Optional[int] = None

class ProjetoItemOut(ProjetoItemBase):
    id: int
    projeto_id: int
    produto_id: Optional[int] = None
    produto_nome_sugerido: Optional[str] = None
    class Config:
        from_attributes = True

class ProjetoItemUpdate(BaseModel):
    nome: Optional[str] = None
    quantidade: Optional[int] = Field(None, ge=1)
    material: Optional[str] = None
    comprimento: Optional[float] = None
    largura: Optional[float] = None
    altura: Optional[float] = None
    produto_id: Optional[int] = None
    preco_sugerido_centavos: Optional[int] = Field(None, ge=0)
    observacoes: Optional[str] = None

class ProjetoCreatePush(BaseModel):
    """Payload normalizado usado tanto pelo parser de CSV quanto pelo endpoint de push (extensão externa)."""
    nome: str = Field(..., max_length=200)
    cliente_id: Optional[int] = None
    origem: str = "sketchup"
    origem_meta: Optional[str] = None
    itens: List[ProjetoItemCreate] = Field(..., min_length=1)

    @field_validator('origem')
    def validate_origem(cls, v):
        if v not in PROJETO_ORIGENS_PERMITIDAS:
            raise ValueError(f'Origem inválida: {PROJETO_ORIGENS_PERMITIDAS}')
        return v

class ProjetoOut(BaseModel):
    id: int
    nome: str
    cliente_id: Optional[int] = None
    usuario_id: int
    origem: str
    origem_meta: Optional[str] = None
    created_at: datetime
    cliente_nome: Optional[str] = None
    usuario_nome: Optional[str] = None
    total_itens: Optional[int] = None
    class Config:
        from_attributes = True

class ProjetoDetailOut(ProjetoOut):
    itens: List[ProjetoItemOut] = []


# --- API Keys (autenticação máquina-a-máquina para integrações) ---

class ApiKeyCreate(BaseModel):
    nome: str = Field(..., max_length=150, pattern=r"^[^<>]*$")
    usuario_id: Optional[int] = None  # admin pode emitir em nome de outro usuário; vendedor sempre emite para si

class ApiKeyCreated(BaseModel):
    id: int
    nome: str
    prefixo: str
    chave: str  # valor completo — retornado só nesta resposta, nunca mais
    created_at: datetime

class ApiKeyOut(BaseModel):
    id: int
    nome: str
    prefixo: str
    usuario_id: int
    usuario_nome: Optional[str] = None
    ativo: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# --- Financeiro (ledger de lançamentos: contas a pagar/receber) ---

class LancamentoCreate(BaseModel):
    descricao: str = Field(..., max_length=200, pattern=r"^[^<>]*$")
    categoria: Optional[str] = Field(None, max_length=100, pattern=r"^[^<>]*$")
    valor: int = Field(..., gt=0)  # em centavos
    tipo: str = "SAIDA"
    data_vencimento: datetime

    @field_validator('tipo')
    def validate_tipo(cls, v):
        if v not in ('ENTRADA', 'SAIDA'): raise ValueError("Tipo deve ser 'ENTRADA' ou 'SAIDA'.")
        return v

class LancamentoOut(BaseModel):
    id: int
    tipo: str
    descricao: str
    categoria: Optional[str] = None
    valor: int
    status: str
    data_vencimento: datetime
    data_pagamento: Optional[datetime] = None
    automatico: bool
    orcamento_id: Optional[int] = None
    usuario_id: int
    created_at: datetime
    vencido: bool = False
    class Config:
        from_attributes = True

class FinanceiroResumoOut(BaseModel):
    a_receber: int  # soma pendente ENTRADA, em centavos
    recebido_no_periodo: int
    vencidos: int
    margem_media: Optional[float] = None  # percentual (0-100), None se não houver base de cálculo
    titulos_abertos: int

class FluxoMensalItem(BaseModel):
    mes: str  # "2026-08"
    entradas: int
    saidas: int

