from pydantic import BaseModel, EmailStr, field_validator, Field, model_validator
from typing import List, Optional, Literal
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import re


# Unidade de medida de uma peça de marmoraria. Define como o preço unitário é
# multiplicado no total da linha (ver calcular_total_linha).
UNIDADES_MEDIDA = ("m2", "linear", "un")
UnidadeMedida = Literal["m2", "linear", "un"]

# O QUE se vende. Obra e Projeto aceitam produto e serviço; Peça só produto; Externo só
# produto de terceiro. Substitui Venda/Locacao/Producao herdados do ERP de interiores —
# marmoraria não aluga, então locação foi descartada junto com a renovação.
TipoOrcamento = Literal["Obra", "Peça", "Projeto", "Externo"]
# COMO a venda acontece — ortogonal ao tipo.
Modalidade = Literal["venda_direta", "orcamento_formal"]


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
    """Cadastro de cliente PF ou PJ.

    `nome_fantasia` NÃO entra aqui: é derivado no router a partir de nome+sobrenome (PF)
    ou razao_social (PJ), para que os ~12 pontos que já leem esse campo continuem valendo.
    """
    tipo_pessoa: Literal["fisica", "juridica"] = "juridica"
    nome: Optional[str] = Field(None, max_length=100, pattern=r"^[^<>]*$")
    sobrenome: Optional[str] = Field(None, max_length=100, pattern=r"^[^<>]*$")
    razao_social: Optional[str] = Field(None, max_length=150, pattern=r"^[^<>]*$")
    cpf_cnpj: Optional[str] = Field(None, max_length=20)
    nome_responsavel: Optional[str] = None
    email: Optional[EmailStr] = None
    contato: Optional[str] = Field(None, max_length=30)
    telefone_secundario: Optional[str] = Field(None, max_length=30)
    cep: Optional[str] = Field(None, max_length=10)
    numero: Optional[str] = Field(None, max_length=20)
    complemento: Optional[str] = Field(None, max_length=100)
    bairro: Optional[str] = Field(None, max_length=100)
    cidade: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    endereco_entrega: Optional[str] = None
    endereco_faturamento: Optional[str] = None
    carteira: bool = False
    indicado_por: Optional[str] = Field(None, max_length=150, pattern=r"^[^<>]*$")
    profissional_tipo: Optional[str] = Field(None, max_length=60, pattern=r"^[^<>]*$")
    status: Optional[str] = "ativo"

    @model_validator(mode="after")
    def validar_por_tipo_pessoa(self):
        if self.tipo_pessoa == "fisica":
            if not (self.nome and self.nome.strip()) or not (self.sobrenome and self.sobrenome.strip()):
                raise ValueError("Pessoa física exige nome e sobrenome.")
        else:
            if not (self.razao_social and self.razao_social.strip()):
                raise ValueError("Pessoa jurídica exige razão social.")
        return self

    def nome_exibicao(self) -> str:
        """Valor derivado gravado em Cliente.nome_fantasia."""
        if self.tipo_pessoa == "fisica":
            return f"{(self.nome or '').strip()} {(self.sobrenome or '').strip()}".strip()
        return (self.razao_social or "").strip()


class ClienteOut(ClienteCreate):
    id: int
    usuario_id: int
    nome_fantasia: str
    criado_por_id: Optional[int] = None
    editado_por_id: Optional[int] = None
    editado_em: Optional[datetime] = None
    criado_por_nome: Optional[str] = None
    editado_por_nome: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


class CepOut(BaseModel):
    """Resposta do proxy de CEP. Campos vazios quando a consulta não encontra nada —
    o cadastro nunca é bloqueado por falha de CEP."""
    cep: str
    logradouro: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None

def calcular_total_linha(
    unidade_medida: str,
    quantidade: int,
    preco_unitario: int,
    area_m2: Optional[float],
    comprimento_m: Optional[float],
    acrescimo_centavos: int = 0,
    desconto_centavos: int = 0,
) -> int:
    """Total de uma linha do orçamento, em centavos.

    O que `preco_unitario` significa depende da unidade da peça, e é isso que difere uma
    marmoraria de um catálogo comum:
      - m2      → R$/m², multiplicado pela área (bancada, pedra)
      - linear  → R$/metro, multiplicado pelo comprimento (saia, rodabase, soleira)
      - un      → R$/unidade, multiplicado pela quantidade (cuba, peça avulsa, item externo)

    Arredonda uma única vez, no fim: arredondar a área antes propaga erro de centavo para
    o total do orçamento e gera divergência entre a tela e o PDF.
    """
    if unidade_medida == "m2":
        base = Decimal(str(area_m2 or 0)) * Decimal(preco_unitario)
    elif unidade_medida == "linear":
        base = Decimal(str(comprimento_m or 0)) * Decimal(preco_unitario)
    else:
        base = Decimal(quantidade) * Decimal(preco_unitario)
    total = base.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(total) + (acrescimo_centavos or 0) - (desconto_centavos or 0)


class OrcamentoItemCreate(BaseModel):
    produto_id: Optional[int] = None
    servico_id: Optional[int] = None
    servico_componente_id: Optional[int] = None
    quantidade: int
    preco_unitario_aplicado: int
    unidade_medida: UnidadeMedida = "un"
    local_id: Optional[int] = None
    local_instalacao: Optional[str] = None  # legado; itens novos usam local_id
    comprimento_m: Optional[float] = Field(None, ge=0)
    largura_m: Optional[float] = Field(None, ge=0)
    acrescimo_centavos: int = Field(0, ge=0)
    desconto_centavos: int = Field(0, ge=0)
    is_externo: bool = False
    nome_externo: Optional[str] = None
    descricao_externa: Optional[str] = None
    fornecedor_externo: Optional[str] = None
    foto_externa_url: Optional[str] = None
    personalizacao_aplicada: Optional[str] = None
    prazo_entrega_valor: Optional[int] = None
    prazo_entrega_unidade: Optional[str] = None
    projeto_item_id: Optional[int] = None
    # codigo_item, area_m2 e grupo_id NÃO entram aqui: são gerados no backend. O PUT de
    # orçamento é substituição total, então aceitar do cliente permitiria sobrescrever
    # valor calculado com lixo.

    @model_validator(mode="after")
    def validar_tipo_unico(self):
        tipos_preenchidos = sum([
            bool(self.produto_id),
            bool(self.servico_id),
            bool(self.is_externo),
        ])
        if tipos_preenchidos != 1:
            raise ValueError("Cada item deve referenciar exatamente um entre produto, serviço ou item externo.")
        return self

    @model_validator(mode="after")
    def validar_medidas_por_unidade(self):
        if self.unidade_medida == "m2" and not (self.comprimento_m and self.largura_m):
            raise ValueError("Item medido em m² exige comprimento e largura.")
        if self.unidade_medida == "linear" and not self.comprimento_m:
            raise ValueError("Item medido em metro linear exige comprimento.")
        return self


class OrcamentoItemOut(OrcamentoItemCreate):
    id: int
    orcamento_id: int
    codigo_item: Optional[int] = None
    area_m2: Optional[float] = None
    grupo_id: Optional[str] = None
    nome: Optional[str] = None
    foto_url: Optional[str] = None
    local_nome: Optional[str] = None  # evita que o frontend perca o dado se o local for desativado
    # Derivado do trio produto/servico/externo — a tabela do orçamento exibe como coluna.
    tipo_item: Optional[Literal["servico", "produto", "externo"]] = None
    total_centavos: Optional[int] = None
    class Config:
        from_attributes = True

class VendaPagamentoIn(BaseModel):
    """Pagamento escolhido no fechamento. A obrigatoriedade da Forma depende de
    `TipoPagamento.exige_forma`, que só é conhecida consultando o banco — validado no router."""
    tipo_pagamento_id: int
    forma_pagamento_id: Optional[int] = None
    condicao_pagamento_id: Optional[int] = None


class OrcamentoCreate(BaseModel):
    cliente_id: int
    tipo_orcamento: TipoOrcamento
    modalidade: Modalidade = "orcamento_formal"
    vendedor_id: Optional[int] = None  # Admin pode selecionar; vendedor ignora

    # Opcionais
    arquiteto_nome: Optional[str] = None
    arquiteto_contato: Optional[str] = None
    data_entrega: Optional[datetime] = None
    condicoes_pagamento_selecionadas: Optional[str] = None
    desconto_global_centavos: int = Field(0, ge=0)
    itens: List[OrcamentoItemCreate]
    projeto_id: Optional[int] = None
    # Venda direta fecha a venda no mesmo request; orçamento formal só coleta pagamento
    # depois da aprovação do cliente, na conversão em venda.
    pagamento: Optional[VendaPagamentoIn] = None

    @model_validator(mode="after")
    def validar_regras_por_tipo(self):
        if self.modalidade == "venda_direta" and not self.pagamento:
            raise ValueError("Venda direta exige os dados de pagamento.")
        if self.tipo_orcamento in ("Peça", "Externo") and any(i.servico_id for i in self.itens):
            raise ValueError(f"Orçamento do tipo '{self.tipo_orcamento}' não aceita itens de serviço.")
        if self.tipo_orcamento == "Externo" and any(not i.is_externo for i in self.itens):
            raise ValueError("Orçamento do tipo 'Externo' só aceita itens externos.")
        return self

# Schema básico para listagem no Kanban (com dados expandidos)
class OrcamentoOut(BaseModel):
    id: int
    cliente_id: int
    vendedor_id: int
    tipo_orcamento: str
    modalidade: str = "orcamento_formal"
    status: str
    anexo_url: Optional[str] = None
    created_at: datetime
    data_aprovacao: Optional[datetime] = None
    data_entrega: Optional[datetime] = None
    desconto_global_centavos: int = 0
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
    decisao_cliente: Optional[str] = None
    decisao_cliente_motivo: Optional[str] = None
    decisao_cliente_nome: Optional[str] = None
    decisao_cliente_em: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Schema detalhado para a página de detalhes do orçamento
class OrcamentoDetailOut(BaseModel):
    id: int
    cliente_id: int
    vendedor_id: int
    tipo_orcamento: str
    modalidade: str = "orcamento_formal"
    status: str
    anexo_url: Optional[str] = None
    created_at: datetime
    desconto_global_centavos: int = 0
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
    arquiteto_nome: Optional[str] = None
    arquiteto_contato: Optional[str] = None
    cnpj_faturamento: Optional[str] = None
    projeto_id: Optional[int] = None
    # Necessário para o construtor reenviar a condição intacta: o PUT substitui o orçamento inteiro.
    condicoes_pagamento_selecionadas: Optional[str] = None
    pendencias: List[str] = []
    decisao_cliente: Optional[str] = None
    decisao_cliente_motivo: Optional[str] = None
    decisao_cliente_nome: Optional[str] = None
    decisao_cliente_em: Optional[datetime] = None

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
    visivel_cliente: bool = False


class OrcamentoAnexoVisibilidadeIn(BaseModel):
    visivel_cliente: bool


# Schemas públicos do portal: estes modelos são deliberadamente separados dos
# schemas internos para impedir vazamento acidental de custo, IDs ou caminhos.
class PortalItemOut(BaseModel):
    nome: str
    descricao: Optional[str] = None
    quantidade: int
    preco_unitario: int
    subtotal: int
    local_instalacao: Optional[str] = None
    prazo_entrega_valor: Optional[int] = None
    prazo_entrega_unidade: Optional[str] = None
    foto_url: Optional[str] = None


class PortalDocumentoOut(BaseModel):
    id: int
    nome_original: str
    extensao: Optional[str] = None
    tamanho: Optional[int] = None
    created_at: datetime


class PortalPropostaOut(BaseModel):
    organizacao_nome: Optional[str] = None
    orcamento_id: int
    numero_exibicao: str
    tipo_orcamento: str
    status_publico: str
    cliente_nome: str
    itens: List[PortalItemOut]
    valor_total: int
    condicoes_pagamento: Optional[str] = None
    documentos: List[PortalDocumentoOut] = Field(default_factory=list)
    tem_pdf_proposta: bool
    data_entrega: Optional[datetime] = None
    arquiteto_nome: Optional[str] = None
    arquiteto_contato: Optional[str] = None
    decisao_cliente: Optional[str] = None
    decisao_cliente_nome: Optional[str] = None
    decisao_cliente_motivo: Optional[str] = None
    decisao_cliente_em: Optional[datetime] = None
    criado_em: datetime


class PortalDecisaoIn(BaseModel):
    acao: Literal["aprovar", "recusar"]
    motivo: Optional[str] = Field(default=None, max_length=2000)
    nome: str = Field(..., min_length=2, max_length=200)

    @model_validator(mode="after")
    def validar_motivo_recusa(self):
        if len(self.nome.strip()) < 2:
            raise ValueError("Informe o nome do cliente.")
        if self.acao == "recusar" and (not self.motivo or len(self.motivo.strip()) < 10):
            raise ValueError("Informe um motivo de recusa com pelo menos 10 caracteres.")
        return self


class PortalLinkOut(BaseModel):
    url: str
    expira_em: datetime
    enviado_para: str

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
    organizacao_nome: Optional[str] = None
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

# --- Catálogos configuráveis (Configurações do orçamento) ---
#
# Cada catálogo tem seus próprios Create/Update/Out em vez de herdar de uma base comum:
# uma base Pydantic compartilhada acoplaria catálogos que vão divergir (TipoPagamento já
# tem `exige_forma`, MotivoPerdaAvaria tem `slug`). A reutilização real fica no helper de
# router (routers/catalogos.py), não no schema.

NOME_CATALOGO = Field(..., min_length=1, max_length=120, pattern=r"^[^<>]*$")


class ReordenarIn(BaseModel):
    """Nova ordem completa do catálogo. Enviar a lista inteira evita estados parciais
    no servidor quando a rede cai no meio de uma sequência de cliques."""
    ids_em_ordem: List[int] = Field(..., min_length=1)


class CondicaoPagamentoCreate(BaseModel):
    nome: str = NOME_CATALOGO

class CondicaoPagamentoUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=120, pattern=r"^[^<>]*$")
    ativo: Optional[bool] = None

class CondicaoPagamentoOut(BaseModel):
    id: int
    nome: str
    ativo: bool
    ordem: int
    built_in: bool
    class Config:
        from_attributes = True


class TipoPagamentoCreate(BaseModel):
    nome: str = NOME_CATALOGO
    exige_forma: bool = False

class TipoPagamentoUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=120, pattern=r"^[^<>]*$")
    ativo: Optional[bool] = None
    exige_forma: Optional[bool] = None

class TipoPagamentoOut(BaseModel):
    id: int
    nome: str
    ativo: bool
    ordem: int
    built_in: bool
    exige_forma: bool
    class Config:
        from_attributes = True


class FormaPagamentoCreate(BaseModel):
    nome: str = NOME_CATALOGO
    tipo_pagamento_id: int

class FormaPagamentoUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=120, pattern=r"^[^<>]*$")
    ativo: Optional[bool] = None

class FormaPagamentoOut(BaseModel):
    id: int
    nome: str
    ativo: bool
    ordem: int
    built_in: bool
    tipo_pagamento_id: int
    class Config:
        from_attributes = True


class LocalCreate(BaseModel):
    nome: str = NOME_CATALOGO

class LocalUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=120, pattern=r"^[^<>]*$")
    ativo: Optional[bool] = None

class LocalOut(BaseModel):
    id: int
    nome: str
    ativo: bool
    ordem: int
    built_in: bool
    class Config:
        from_attributes = True


class MotivoPerdaAvariaCreate(BaseModel):
    nome: str = NOME_CATALOGO

class MotivoPerdaAvariaUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=120, pattern=r"^[^<>]*$")
    ativo: Optional[bool] = None

class MotivoPerdaAvariaOut(BaseModel):
    id: int
    nome: str
    slug: str
    ativo: bool
    ordem: int
    built_in: bool
    class Config:
        from_attributes = True


class OrcamentoCondicaoPagamentoUpdate(BaseModel):
    condicao_pagamento: str


# --- Projetos (integração com softwares de arquitetura, ex: SketchUp) ---

PROJETO_ORIGENS_PERMITIDAS = ["sketchup", "manual_csv", "stone"]

class ProjetoItemBase(BaseModel):
    nome: str = Field(..., max_length=200)
    quantidade: int = Field(..., ge=1)
    material: Optional[str] = Field(None, max_length=200)
    comprimento: Optional[float] = None
    largura: Optional[float] = None
    altura: Optional[float] = None
    referencia_externa: Optional[str] = Field(None, max_length=200)
    preco_sugerido_centavos: Optional[int] = Field(None, ge=0)
    observacoes: Optional[str] = Field(None, max_length=2000)

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
    origem_meta: Optional[str] = Field(None, max_length=1000)
    origem_ref: Optional[str] = Field(None, max_length=200)
    origem_rev: Optional[str] = Field(None, max_length=200)
    origem_status: Optional[str] = None
    unidade_dimensao: str = "cm"
    itens: List[ProjetoItemCreate] = Field(..., min_length=1, max_length=2000)

    @field_validator('origem')
    def validate_origem(cls, v):
        if v not in PROJETO_ORIGENS_PERMITIDAS:
            raise ValueError(f'Origem inválida: {PROJETO_ORIGENS_PERMITIDAS}')
        return v

    @field_validator('origem_status')
    def validate_origem_status(cls, v):
        if v is not None and v not in ('rascunho', 'finalizado'):
            raise ValueError("Status de origem deve ser 'rascunho' ou 'finalizado'.")
        return v

    @field_validator('unidade_dimensao')
    def validate_unidade_dimensao(cls, v):
        if v not in ('mm', 'cm'):
            raise ValueError("Unidade de dimensão deve ser 'mm' ou 'cm'.")
        return v

class ProjetoOut(BaseModel):
    id: int
    nome: str
    cliente_id: Optional[int] = None
    usuario_id: int
    origem: str
    origem_meta: Optional[str] = None
    origem_ref: Optional[str] = None
    origem_rev: Optional[str] = None
    origem_status: Optional[str] = None
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


# --- Serviços (catálogo, separado de Produto) ---

class ServicoBase(BaseModel):
    nome: str = Field(..., max_length=150, pattern=r"^[^<>]*$")
    descricao: Optional[str] = Field(None, max_length=2000)
    preco_padrao: int = Field(..., ge=0)  # em centavos
    tempo_medio_valor: int = Field(..., gt=0)
    tempo_medio_unidade: Literal["horas", "dias"]
    ativo: Optional[bool] = True

class ServicoCreate(ServicoBase):
    pass

class ServicoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    preco_padrao: Optional[int] = Field(None, ge=0)
    tempo_medio_valor: Optional[int] = Field(None, gt=0)
    tempo_medio_unidade: Optional[Literal["horas", "dias"]] = None
    ativo: Optional[bool] = None

class ServicoComponenteBase(BaseModel):
    nome: str = Field(..., max_length=120, pattern=r"^[^<>]*$")
    obrigatorio: bool = False
    unidade_medida: UnidadeMedida = "m2"
    preco_unitario: Optional[int] = Field(None, ge=0)  # centavos
    ativo: bool = True

class ServicoComponenteCreate(ServicoComponenteBase):
    pass

class ServicoComponenteUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=120, pattern=r"^[^<>]*$")
    obrigatorio: Optional[bool] = None
    unidade_medida: Optional[UnidadeMedida] = None
    preco_unitario: Optional[int] = Field(None, ge=0)
    ativo: Optional[bool] = None

class ServicoComponenteOut(ServicoComponenteBase):
    id: int
    servico_id: int
    ordem: int
    class Config:
        from_attributes = True


class ServicoOut(ServicoBase):
    id: int
    created_at: datetime
    # Quando há componentes, preco_padrao é informativo: o preço real do serviço no
    # orçamento é a soma dos componentes efetivamente incluídos.
    componentes: List[ServicoComponenteOut] = Field(default_factory=list)
    class Config:
        from_attributes = True


# --- Venda (entidade própria, criada ao converter um Orçamento aprovado) ---

class VendaOut(BaseModel):
    id: int
    orcamento_id: int
    vendedor_id: int
    valor_total: int
    tipo_pagamento_id: Optional[int] = None
    forma_pagamento_id: Optional[int] = None
    condicao_pagamento_id: Optional[int] = None
    data_venda: datetime
    created_at: datetime
    # Campos expandidos
    cliente_nome: Optional[str] = None
    vendedor_nome: Optional[str] = None
    tipo_pagamento_nome: Optional[str] = None
    forma_pagamento_nome: Optional[str] = None
    condicao_pagamento_nome: Optional[str] = None
    class Config:
        from_attributes = True


# --- Perdas e Avarias ---

MOTIVOS_PERDA_AVARIA = [
    "quebra_manuseio",
    "quebra_transporte",
    "defeito_fabricacao",
    "corte_errado",
    "armazenamento_inadequado",
    "outro",
]

class PerdaAvariaCreate(BaseModel):
    produto_id: int
    quantidade: int = Field(..., gt=0)
    motivo: Literal[
        "quebra_manuseio",
        "quebra_transporte",
        "defeito_fabricacao",
        "corte_errado",
        "armazenamento_inadequado",
        "outro",
    ]
    justificativa: str = Field(..., min_length=3, max_length=1000)

class PerdaAvariaOut(PerdaAvariaCreate):
    id: int
    usuario_id: int
    data_ocorrencia: datetime
    created_at: datetime
    produto_nome: Optional[str] = None
    usuario_nome: Optional[str] = None
    class Config:
        from_attributes = True


# --- Equipamentos ---

class EquipamentoBase(BaseModel):
    nome: str = Field(..., max_length=150, pattern=r"^[^<>]*$")
    tipo: Optional[str] = Field(None, max_length=100)
    estado: Literal["operante", "manutencao", "inativo"] = "operante"
    numero_serie: Optional[str] = Field(None, max_length=100)
    data_aquisicao: Optional[datetime] = None
    observacoes: Optional[str] = Field(None, max_length=2000)
    ativo: Optional[bool] = True

class EquipamentoCreate(EquipamentoBase):
    pass

class EquipamentoUpdate(BaseModel):
    nome: Optional[str] = None
    tipo: Optional[str] = None
    estado: Optional[Literal["operante", "manutencao", "inativo"]] = None
    numero_serie: Optional[str] = None
    data_aquisicao: Optional[datetime] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = None

class EquipamentoOut(EquipamentoBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True


# --- Matéria-prima (inventário separado do catálogo de Produto acabado) ---

class MateriaPrimaBase(BaseModel):
    nome: str = Field(..., max_length=150, pattern=r"^[^<>]*$")
    tipo_material: Optional[str] = Field(None, max_length=100)
    fornecedor_id: Optional[int] = None
    unidade_medida: Literal["m2", "un", "kg"] = "m2"
    quantidade_estoque: float = Field(0, ge=0)
    preco_custo: Optional[int] = Field(None, ge=0)  # em centavos
    comprimento: Optional[float] = None
    largura: Optional[float] = None
    espessura: Optional[float] = None
    observacoes: Optional[str] = Field(None, max_length=2000)
    ativo: Optional[bool] = True

class MateriaPrimaCreate(MateriaPrimaBase):
    pass

class MateriaPrimaUpdate(BaseModel):
    nome: Optional[str] = None
    tipo_material: Optional[str] = None
    fornecedor_id: Optional[int] = None
    unidade_medida: Optional[Literal["m2", "un", "kg"]] = None
    quantidade_estoque: Optional[float] = Field(None, ge=0)
    preco_custo: Optional[int] = Field(None, ge=0)
    comprimento: Optional[float] = None
    largura: Optional[float] = None
    espessura: Optional[float] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = None

class MateriaPrimaOut(MateriaPrimaBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

