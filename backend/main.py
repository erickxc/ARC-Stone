import logging
import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import database
import models # Garante que todos os modelos estão registrados antes do create_all
from routers import auth as auth_router
from routers import estoque as estoque_router
from routers import clientes as clientes_router
from routers import orcamentos as orcamentos_router
from routers import uploads as uploads_router
from routers import usuarios as usuarios_router
from routers import fornecedores as fornecedores_router
from routers import calendario as calendario_router
from routers import logs as logs_router
from routers import projetos as projetos_router
from routers import integracoes as integracoes_router
from routers import financeiro as financeiro_router
from routers import portal as portal_router
from routers import servicos as servicos_router
from routers import equipamentos as equipamentos_router
from routers import materia_prima as materia_prima_router
from routers import perdas as perdas_router
from routers import catalogos as catalogos_router
from routers import producao as producao_router
from fastapi.middleware.cors import CORSMiddleware
import auth as auth_module
import shutil

logger = logging.getLogger(__name__)

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from rate_limiter import limiter

# Em produção, /docs, /redoc e /openapi.json ficam desligados — não expor o mapa completo
# da API (rotas, schemas, regras) sem autenticação. Fica ligado por padrão em dev.
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").strip().lower() == "production"

app = FastAPI(
    title="ARC ERP",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# Aplica default_limits do Limiter (100/minute) a TODAS as rotas, não só as com
# @limiter.limit(...) explícito — sem isso, default_limits nunca era enforçado de fato.
app.add_middleware(SlowAPIMiddleware)

# Uploads: diretórios (NÃO montamos StaticFiles público — serve autenticado abaixo)
os.makedirs("uploads", exist_ok=True)
os.makedirs(os.path.join("uploads", "cache"), exist_ok=True)
os.makedirs(os.path.join("uploads_private", "anexos"), exist_ok=True)

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self';"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Configuração de CORS restrito para Frontend Docker e Produção
allowed_origins = [origin.strip() for origin in os.getenv(
    "CORS_ORIGINS",
    "http://localhost,http://localhost:3000,http://localhost:5173,http://localhost:8080",
).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)

# Registra as rotas e os módulos
app.include_router(auth_router.router)
app.include_router(estoque_router.router)
app.include_router(clientes_router.router)
app.include_router(orcamentos_router.router)
app.include_router(uploads_router.router)
app.include_router(usuarios_router.router)
app.include_router(fornecedores_router.router)
app.include_router(calendario_router.router)
app.include_router(logs_router.router)
app.include_router(projetos_router.router)
app.include_router(integracoes_router.router)
app.include_router(financeiro_router.router)
app.include_router(portal_router.router)
app.include_router(servicos_router.router)
app.include_router(equipamentos_router.router)
app.include_router(materia_prima_router.router)
app.include_router(perdas_router.router)
app.include_router(catalogos_router.router)
app.include_router(producao_router.router)


@app.get("/static/uploads/{filename:path}")
def serve_upload_autenticado(
    filename: str,
    request: Request,
    db: Session = Depends(database.get_db),
):
    """Serve arquivos de uploads/ apenas para usuários autenticados (Bearer ou cookie)."""
    # Rejeita path traversal
    safe_name = os.path.basename(filename)
    if not safe_name or safe_name != filename.replace("\\", "/").split("/")[-1]:
        # Permite subpastas controladas (ex.: cache/) sem .. 
        normalized = os.path.normpath(filename).replace("\\", "/")
        if normalized.startswith("..") or normalized.startswith("/"):
            raise HTTPException(status_code=400, detail="Nome de arquivo inválido.")
        file_path = os.path.join("uploads", normalized)
    else:
        file_path = os.path.join("uploads", safe_name)

    uploads_root = os.path.realpath("uploads")
    real_path = os.path.realpath(file_path)
    if not real_path.startswith(uploads_root + os.sep) and real_path != uploads_root:
        raise HTTPException(status_code=400, detail="Caminho inválido.")

    # Auth: Bearer ou cookie access_token
    auth_header = request.headers.get("Authorization") or ""
    bearer = auth_header[7:].strip() if auth_header.startswith("Bearer ") else None
    token = auth_module.extract_bearer_or_cookie(request, bearer)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária.")
    auth_module.decode_token(token, expected_types={auth_module.TOKEN_TYPE_ACCESS})

    if not os.path.isfile(real_path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

    return FileResponse(real_path)


def _migrate_legacy_anexos(db: Session) -> None:
    """Move anexos legados de uploads/ público para uploads_private/anexos/."""
    from models import OrcamentoAnexo
    anexos = db.query(OrcamentoAnexo).all()
    moved = 0
    for anexo in anexos:
        url = anexo.url or ""
        name = os.path.basename(url)
        if not name:
            continue
        private_path = os.path.join("uploads_private", "anexos", name)
        legacy_path = os.path.join("uploads", name)
        # Já migrado
        if url.startswith("anexos/") and os.path.exists(private_path):
            continue
        if os.path.exists(legacy_path):
            os.makedirs(os.path.join("uploads_private", "anexos"), exist_ok=True)
            if not os.path.exists(private_path):
                shutil.move(legacy_path, private_path)
            anexo.url = f"anexos/{name}"
            moved += 1
        elif os.path.exists(private_path) and not url.startswith("anexos/"):
            anexo.url = f"anexos/{name}"
            moved += 1
    if moved:
        db.commit()
        print(f"[MIGRATE] {moved} anexo(s) legado(s) movidos para uploads_private.")


@app.on_event("startup")
def on_startup():
    # Serializa bootstrap/schema patch quando mais de uma réplica inicia ao mesmo
    # tempo. Ainda é uma migração provisória; produção deve usar ferramenta versionada.
    with database.engine.begin() as conn:
        conn.execute(text("SELECT pg_advisory_xact_lock(728391)"))
        # Para o MVP, cria as tabelas automaticamente baseadas nos models.
        database.Base.metadata.create_all(bind=conn)
        # Migração leve: adiciona colunas novas em tabelas já existentes (create_all não faz ALTER)
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS cnpj_faturamento VARCHAR"))
        conn.execute(text("ALTER TABLE orcamento_config ADD COLUMN IF NOT EXISTS empresa1_nome VARCHAR"))
        conn.execute(text("ALTER TABLE orcamento_config ADD COLUMN IF NOT EXISTS empresa1_cnpj VARCHAR"))
        conn.execute(text("ALTER TABLE orcamento_config ADD COLUMN IF NOT EXISTS empresa2_nome VARCHAR"))
        conn.execute(text("ALTER TABLE orcamento_config ADD COLUMN IF NOT EXISTS empresa2_cnpj VARCHAR"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS projeto_id INTEGER"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS portal_token_version INTEGER NOT NULL DEFAULT 0"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS decisao_cliente VARCHAR"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS decisao_cliente_motivo VARCHAR"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS decisao_cliente_nome VARCHAR"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS decisao_cliente_em TIMESTAMPTZ"))
        conn.execute(text("ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS projeto_item_id INTEGER"))
        conn.execute(text("ALTER TABLE orcamento_anexos ADD COLUMN IF NOT EXISTS visivel_cliente BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_version INTEGER NOT NULL DEFAULT 0"))
        conn.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sessao_token_version INTEGER NOT NULL DEFAULT 0"))
        conn.execute(text("ALTER TABLE orcamento_config ADD COLUMN IF NOT EXISTS organizacao_nome VARCHAR"))
        conn.execute(text("ALTER TABLE projetos ADD COLUMN IF NOT EXISTS origem_ref VARCHAR"))
        conn.execute(text("ALTER TABLE projetos ADD COLUMN IF NOT EXISTS origem_rev VARCHAR"))
        conn.execute(text("ALTER TABLE projetos ADD COLUMN IF NOT EXISTS origem_status VARCHAR"))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_projetos_origem_ref "
            "ON projetos (usuario_id, origem, origem_ref, origem_rev) "
            "WHERE origem_ref IS NOT NULL"
        ))
        # PostgreSQL trata NULL como distinto em índices UNIQUE. Este índice
        # complementar mantém a idempotência também quando uma integração
        # legada envia origem_ref sem informar origem_rev.
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_projetos_origem_ref_sem_rev "
            "ON projetos (usuario_id, origem, origem_ref) "
            "WHERE origem_ref IS NOT NULL AND origem_rev IS NULL"
        ))
        # Corrige a FK de lançamentos_financeiros criada antes de ON DELETE SET NULL existir
        # no model — sem isso, excluir um orçamento com lançamento pago vinculado falha.
        conn.execute(text("ALTER TABLE lancamentos_financeiros DROP CONSTRAINT IF EXISTS lancamentos_financeiros_orcamento_id_fkey"))
        conn.execute(text(
            "ALTER TABLE lancamentos_financeiros ADD CONSTRAINT lancamentos_financeiros_orcamento_id_fkey "
            "FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL"
        ))
        # ARC Stone: item de orçamento pode referenciar um serviço do catálogo (além/no lugar de produto)
        conn.execute(text("ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS servico_id INTEGER REFERENCES servicos(id)"))
        # ARC Stone: catálogos configuráveis ganham ordem/built_in (condicoes_pagamento é pré-existente)
        conn.execute(text("ALTER TABLE condicoes_pagamento ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0"))
        conn.execute(text("ALTER TABLE condicoes_pagamento ADD COLUMN IF NOT EXISTS built_in BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE condicoes_pagamento ALTER COLUMN ativo SET DEFAULT TRUE"))
        conn.execute(text("UPDATE condicoes_pagamento SET ativo = TRUE WHERE ativo IS NULL"))
        conn.execute(text("ALTER TABLE condicoes_pagamento ALTER COLUMN ativo SET NOT NULL"))
        # Condições legadas não tinham ordem: usa o id como ordem inicial, preservando a sequência atual.
        conn.execute(text("UPDATE condicoes_pagamento SET ordem = id WHERE ordem = 0"))
        # ARC Stone: cliente PF/PJ, endereço estruturado, relacionamento e trilha de autoria
        for coluna, tipo in [
            ("tipo_pessoa", "VARCHAR NOT NULL DEFAULT 'juridica'"),
            ("nome", "VARCHAR"), ("sobrenome", "VARCHAR"), ("razao_social", "VARCHAR"),
            ("telefone_secundario", "VARCHAR"),
            ("cep", "VARCHAR"), ("numero", "VARCHAR"), ("complemento", "VARCHAR"),
            ("bairro", "VARCHAR"), ("cidade", "VARCHAR"), ("estado", "VARCHAR(2)"),
            ("carteira", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("indicado_por", "VARCHAR"), ("profissional_tipo", "VARCHAR"),
            ("criado_por_id", "INTEGER REFERENCES usuarios(id)"),
            ("editado_por_id", "INTEGER REFERENCES usuarios(id)"),
            ("editado_em", "TIMESTAMPTZ"),
        ]:
            conn.execute(text(f"ALTER TABLE clientes ADD COLUMN IF NOT EXISTS {coluna} {tipo}"))
        # Clientes legados foram cadastrados como PJ (só tinham nome_fantasia): backfill de
        # razao_social a partir do nome de exibição, para o formulário PF/PJ abrir preenchido.
        conn.execute(text("UPDATE clientes SET razao_social = nome_fantasia WHERE razao_social IS NULL"))
        # Autoria retroativa: sem histórico de quem criou, assume o vendedor dono.
        conn.execute(text("UPDATE clientes SET criado_por_id = usuario_id WHERE criado_por_id IS NULL"))
        # ARC Stone: medidas e ajustes por linha do orçamento
        for coluna, tipo in [
            ("local_id", "INTEGER REFERENCES locais(id)"),
            ("codigo_item", "INTEGER"),
            ("comprimento_m", "NUMERIC(10,2)"), ("largura_m", "NUMERIC(10,2)"), ("area_m2", "NUMERIC(10,2)"),
            ("unidade_medida", "VARCHAR NOT NULL DEFAULT 'un'"),
            ("servico_componente_id", "INTEGER REFERENCES servico_componentes(id)"),
            ("grupo_id", "VARCHAR"),
        ]:
            conn.execute(text(f"ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS {coluna} {tipo}"))
        # Marmoraria não desconta/acrescenta por linha, só no fechamento do orçamento
        # (desconto_global_centavos): remove as colunas por item que existiram até aqui.
        conn.execute(text("ALTER TABLE orcamento_itens DROP COLUMN IF EXISTS acrescimo_centavos"))
        conn.execute(text("ALTER TABLE orcamento_itens DROP COLUMN IF EXISTS desconto_centavos"))
        # Itens legados não têm código: numera por orçamento, na ordem de inserção.
        conn.execute(text(
            "UPDATE orcamento_itens oi SET codigo_item = seq.rn FROM ("
            "  SELECT id, ROW_NUMBER() OVER (PARTITION BY orcamento_id ORDER BY id) AS rn"
            "  FROM orcamento_itens WHERE codigo_item IS NULL"
            ") seq WHERE oi.id = seq.id AND oi.codigo_item IS NULL"
        ))
        # ARC Stone: modalidade da venda e desconto de fechamento
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS modalidade VARCHAR NOT NULL DEFAULT 'orcamento_formal'"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS desconto_global_centavos INTEGER NOT NULL DEFAULT 0"))
        # ARC Stone: pagamento congelado na venda
        conn.execute(text("ALTER TABLE vendas ADD COLUMN IF NOT EXISTS tipo_pagamento_id INTEGER REFERENCES tipos_pagamento(id)"))
        conn.execute(text("ALTER TABLE vendas ADD COLUMN IF NOT EXISTS forma_pagamento_id INTEGER REFERENCES formas_pagamento(id)"))
        conn.execute(text("ALTER TABLE vendas ADD COLUMN IF NOT EXISTS condicao_pagamento_id INTEGER REFERENCES condicoes_pagamento(id)"))
        # ARC Stone: campos de relacionamento do cliente
        for coluna, tipo in [
            ("data_nascimento", "TIMESTAMPTZ"),
            ("origem_contato", "VARCHAR"),
            ("preferencia_contato", "VARCHAR"),
        ]:
            conn.execute(text(f"ALTER TABLE clientes ADD COLUMN IF NOT EXISTS {coluna} {tipo}"))
        # Tipos herdados do ERP de interiores não existem na marmoraria. Ambiente ainda em
        # desenvolvimento: converte em vez de manter valores órfãos fora do novo Literal.
        conn.execute(text("UPDATE orcamentos SET tipo_orcamento = 'Peça' WHERE tipo_orcamento IN ('Venda', 'Locacao', 'Locação')"))
        conn.execute(text("UPDATE orcamentos SET tipo_orcamento = 'Obra' WHERE tipo_orcamento IN ('Producao', 'Produção')"))
        # Funil de status renomeado/expandido: reaproveita os orçamentos já gravados com os nomes antigos.
        conn.execute(text("UPDATE orcamentos SET status = 'Gerando projeto' WHERE status = 'Planejando'"))
        conn.execute(text("UPDATE orcamentos SET status = 'Projeto enviado' WHERE status = 'Orçamento gerado'"))
        conn.execute(text("UPDATE orcamentos SET status = 'Entrega' WHERE status = 'Entregue'"))
        # Esteira de produção: funil expandido de 5 para 8 etapas. Built-in nunca é excluído
        # (regra do CatalogoSimplesMixin) — renomeia/reordena as existentes para a mais
        # parecida e insere só as que não tinham equivalente. Só roda em bancos que já
        # tinham etapas antes desta mudança; banco novo nasce direto com as 8 via
        # `_semear_catalogos`, então os UPDATEs abaixo não encontram nada pra alterar.
        if conn.execute(text("SELECT EXISTS(SELECT 1 FROM etapas_producao)")).scalar():
            conn.execute(text("UPDATE etapas_producao SET nome = 'Em Análise', ordem = 2 WHERE nome = 'Medição'"))
            conn.execute(text("UPDATE etapas_producao SET ordem = 4 WHERE nome = 'Corte'"))
            conn.execute(text("UPDATE etapas_producao SET ordem = 5 WHERE nome = 'Acabamento'"))
            conn.execute(text("UPDATE etapas_producao SET nome = 'Entrega', ordem = 7 WHERE nome = 'Instalação'"))
            conn.execute(text("UPDATE etapas_producao SET ordem = 8 WHERE nome = 'Concluído'"))
            for nome_etapa, ordem_etapa in [("Projeto", 1), ("Aguardando material", 3), ("Ajustes", 6)]:
                conn.execute(text(
                    "INSERT INTO etapas_producao (nome, ordem, ativo, built_in, is_final) "
                    "SELECT :nome, :ordem, true, true, false "
                    "WHERE NOT EXISTS (SELECT 1 FROM etapas_producao WHERE nome = :nome)"
                ), {"nome": nome_etapa, "ordem": ordem_etapa})
        # Acabamento "trabalhado" é preço, não produto separado: uma pedra tem preco_venda
        # (reto) e opcionalmente preco_venda_trabalhado, em vez de duas linhas no catálogo.
        conn.execute(text("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_venda_trabalhado INTEGER"))

    db = database.SessionLocal()
    try:
        _migrate_legacy_anexos(db)

        # Seeding: Cria um usuário Admin padrão se o banco estiver vazio
        from models import Usuario
        from auth import get_password_hash
        if db.query(Usuario).count() == 0:
            admin_email = os.getenv("ADMIN_EMAIL")
            admin_pass = os.getenv("ADMIN_PASSWORD")

            if not admin_email or not admin_pass:
                print("WARNING: ADMIN_EMAIL ou ADMIN_PASSWORD não configurados. O Admin não será criado.")
            else:
                admin_user = Usuario(
                    nome="Administrador ARC",
                    email=admin_email,
                    hashed_password=get_password_hash(admin_pass),
                    role="admin",
                    ativo=True
                )
                db.add(admin_user)
                db.commit()

        _semear_catalogos(db)
    finally:
        db.close()


def _semear_catalogos(db):
    """Popula os catálogos configuráveis com os valores padrão do sistema.

    Idempotente por catálogo: só semeia o que está vazio, para não ressuscitar itens que
    o usuário desativou nem duplicar a cada start. Tudo entra com `built_in=True` — pode
    ser desativado e reordenado na tela de Configurações, nunca excluído.
    """
    from models import TipoPagamento, FormaPagamento, Local, MotivoPerdaAvaria

    if db.query(TipoPagamento).count() == 0:
        # Só Cartão se desdobra em Crédito/Débito; os demais tipos não têm segunda etapa.
        tipos = [
            TipoPagamento(nome="Cartão", ordem=1, ativo=True, built_in=True, exige_forma=True),
            TipoPagamento(nome="Dinheiro", ordem=2, ativo=True, built_in=True, exige_forma=False),
            TipoPagamento(nome="Crediário", ordem=3, ativo=True, built_in=True, exige_forma=False),
            TipoPagamento(nome="Cheque", ordem=4, ativo=True, built_in=True, exige_forma=False),
            TipoPagamento(nome="Pix", ordem=5, ativo=True, built_in=True, exige_forma=False),
        ]
        db.add_all(tipos)
        db.flush()  # precisa do id do Cartão para vincular as formas
        cartao = next(t for t in tipos if t.nome == "Cartão")
        db.add_all([
            FormaPagamento(nome="Crédito", tipo_pagamento_id=cartao.id, ordem=1, ativo=True, built_in=True),
            FormaPagamento(nome="Débito", tipo_pagamento_id=cartao.id, ordem=2, ativo=True, built_in=True),
        ])
        db.commit()

    if db.query(Local).count() == 0:
        padroes = ["Cozinha", "Banheiro", "Área de serviço", "Área externa", "Sala", "Churrasqueira"]
        db.add_all([
            Local(nome=nome, ordem=i, ativo=True, built_in=True)
            for i, nome in enumerate(padroes, start=1)
        ])
        db.commit()

    from models import EtapaProducao
    if db.query(EtapaProducao).count() == 0:
        # Sequência padrão de uma marmoraria. `ordem` é a sequência da esteira, não só
        # exibição; a última etapa fecha a ordem (is_final).
        padroes = [
            ("Projeto", False), ("Em Análise", False), ("Aguardando material", False),
            ("Corte", False), ("Acabamento", False), ("Ajustes", False),
            ("Entrega", False), ("Concluído", True),
        ]
        db.add_all([
            EtapaProducao(nome=nome, ordem=i, ativo=True, built_in=True, is_final=final)
            for i, (nome, final) in enumerate(padroes, start=1)
        ])
        db.commit()

    if db.query(MotivoPerdaAvaria).count() == 0:
        # slug preserva os valores que PerdaAvaria.motivo já grava (coluna continua texto).
        padroes = [
            ("quebra_manuseio", "Quebra no manuseio"),
            ("quebra_transporte", "Quebra no transporte"),
            ("defeito_fabricacao", "Defeito de fabricação"),
            ("corte_errado", "Corte errado"),
            ("armazenamento_inadequado", "Armazenamento inadequado"),
            ("outro", "Outro"),
        ]
        db.add_all([
            MotivoPerdaAvaria(slug=slug, nome=nome, ordem=i, ativo=True, built_in=True)
            for i, (slug, nome) in enumerate(padroes, start=1)
        ])
        db.commit()

@app.get("/")
def read_root():
    return {
        "sistema": "ARC ERP",
        "status": "Online",
        "mensagem": "A API está rodando via Docker com sucesso!"
    }

@app.get("/health")
def health_check(db: Session = Depends(database.get_db)):
    try:
        # Testa a conexão executando uma query simples
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "conectado ao PostgreSQL"}
    except Exception as exc:
        # Detalhe do driver pode conter host, schema ou credenciais. Loga no
        # servidor apenas com o tipo da falha, mas responde mensagem estável ao
        # cliente e evita registrar DSN/senha em logs.
        logger.error("Health check do banco falhou (%s)", type(exc).__name__)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "error", "database": "indisponível"},
        )
