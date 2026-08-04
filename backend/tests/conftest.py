"""Fixtures compartilhadas para os testes de integração (auth, orçamentos, RBAC).

`main.py` roda ALTER TABLE ... ADD COLUMN IF NOT EXISTS no startup — sintaxe
específica de Postgres (SQLite local costuma não suportar). Por isso os testes
usam um banco Postgres de teste dedicado (mesmo servidor do `docker compose`,
banco separado do de desenvolvimento) em vez de SQLite. Requer o serviço `db`
do docker compose rodando (`docker compose up -d db`) com o banco
`arc_erp_test` criado uma vez (`CREATE DATABASE arc_erp_test;`).

Rodar de dentro do container `api` (evita um bug de encoding do psycopg2 ao
conectar em Postgres a partir do Python nativo do Windows, sem relação com o
código do projeto):

    docker compose up -d db
    docker exec -e DATABASE_URL="postgresql://<user>:<senha>@db:5432/arc_erp_test" \
        -e SECRET_KEY="test-secret-key-somente-para-pytest" -w /app arc_api \
        python -m pytest tests -q

`pytest backend/tests` direto no host continua funcionando para os testes que
não tocam banco (test_ssrf_utils.py, test_anexo_utils.py).
"""
import os
import sys
import uuid
from pathlib import Path

import pytest
from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

_env = dotenv_values(REPO_ROOT / ".env")
_pg_user = _env.get("POSTGRES_USER", "arc_user")
_pg_password = _env.get("POSTGRES_PASSWORD", "")
_pg_host = os.getenv("TEST_DB_HOST", "localhost")
_pg_port = os.getenv("TEST_DB_PORT", "5432")

os.environ.setdefault(
    "DATABASE_URL",
    f"postgresql://{_pg_user}:{_pg_password}@{_pg_host}:{_pg_port}/arc_erp_test",
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-somente-para-pytest")
os.environ.setdefault("CORS_ORIGINS", "http://localhost")
# Sem ADMIN_EMAIL/ADMIN_PASSWORD: o seeding do startup fica no-op (só avisa),
# cada teste cria os usuários que precisa.

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
import models  # noqa: E402
import auth as auth_module  # noqa: E402
from rate_limiter import limiter  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture()
def client():
    # Escopo por teste (não por sessão) para que cada teste comece com cookies
    # limpos — evita vazamento de sessão logada entre testes.
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Evita que os limites de /auth/login etc. (5/min) vazem entre testes."""
    limiter.reset()
    yield


@pytest.fixture()
def db_session():
    session = database.SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _unique_email(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture()
def make_user(db_session):
    """Cria um Usuario direto no banco (bypassa a API) com senha conhecida em texto puro."""
    created = []

    def _make(role: str = "vendedor", password: str = "SenhaForte@123", ativo: bool = True, **overrides):
        email = overrides.pop("email", None) or _unique_email(role)
        nome = overrides.pop("nome", None) or f"Usuário {role.title()} {uuid.uuid4().hex[:6]}"
        user = models.Usuario(
            nome=nome,
            email=email,
            hashed_password=auth_module.get_password_hash(password),
            role=role,
            ativo=ativo,
            **overrides,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        created.append(user.id)
        user._plain_password = password  # atalho só para os testes, não é um campo do model
        return user

    yield _make


@pytest.fixture()
def make_client(db_session):
    def _make(vendedor: models.Usuario, **overrides):
        cliente = models.Cliente(
            usuario_id=vendedor.id,
            nome_fantasia=overrides.pop("nome_fantasia", None) or f"Cliente {uuid.uuid4().hex[:6]}",
            status=overrides.pop("status", "ativo"),
            **overrides,
        )
        db_session.add(cliente)
        db_session.commit()
        db_session.refresh(cliente)
        return cliente

    return _make


@pytest.fixture()
def make_product(db_session):
    def _make(**overrides):
        produto = models.Produto(
            nome=overrides.pop("nome", None) or f"Produto {uuid.uuid4().hex[:6]}",
            preco_custo=overrides.pop("preco_custo", 1000),
            preco_venda=overrides.pop("preco_venda", 2000),
            quantidade_estoque=overrides.pop("quantidade_estoque", 10),
            quantidade_retida=overrides.pop("quantidade_retida", 0),
            **overrides,
        )
        db_session.add(produto)
        db_session.commit()
        db_session.refresh(produto)
        return produto

    return _make


def login_client(client: TestClient, email: str, password: str) -> TestClient:
    """Loga via /auth/login e devolve o mesmo TestClient com os cookies de sessão setados."""
    resp = client.post("/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["mfa_required"] is False
    return client
