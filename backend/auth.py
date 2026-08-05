import hashlib
import os
from html import escape
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, Header, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("A variável de ambiente SECRET_KEY não está configurada.")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
PORTAL_TOKEN_EXPIRE_DAYS = int(os.getenv("PORTAL_TOKEN_EXPIRE_DAYS", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
TOKEN_TYPE_RESET = "reset"
TOKEN_TYPE_MFA_PENDING = "mfa_pending"
TOKEN_TYPE_PORTAL = "portal"


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if "type" not in to_encode:
        to_encode["type"] = TOKEN_TYPE_ACCESS
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_portal_token(orcamento: models.Orcamento) -> str:
    """Emite token público mínimo, sem PII e revogável por versão no orçamento."""
    return create_access_token(
        {
            "type": TOKEN_TYPE_PORTAL,
            "orcamento_id": orcamento.id,
            "ver": orcamento.portal_token_version,
        },
        expires_delta=timedelta(days=PORTAL_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str, expected_types: set[str] | None = None) -> dict:
    """Decodifica JWT e opcionalmente exige um conjunto de `type`s."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou token expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise credentials_exception
    if expected_types is not None:
        token_type = payload.get("type", TOKEN_TYPE_ACCESS)
        if token_type not in expected_types:
            raise credentials_exception
    return payload


def extract_bearer_or_cookie(request: Request, bearer: Optional[str] = None) -> Optional[str]:
    if bearer:
        return bearer
    return request.cookies.get("access_token")


def get_portal_orcamento(request: Request, db: Session = Depends(get_db)) -> models.Orcamento:
    """Resolve exclusivamente o token público enviado no header X-Portal-Token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Link inválido ou expirado.",
    )
    try:
        raw = request.headers.get("X-Portal-Token")
        if not raw:
            raise credentials_exception
        payload = decode_token(raw, expected_types={TOKEN_TYPE_PORTAL})
        orcamento_id = payload.get("orcamento_id")
        versao = payload.get("ver")
        if not isinstance(orcamento_id, int) or not isinstance(versao, int):
            raise credentials_exception

        orcamento = db.query(models.Orcamento).filter(models.Orcamento.id == orcamento_id).first()
        if not orcamento or versao != orcamento.portal_token_version:
            raise credentials_exception
        return orcamento
    except HTTPException:
        raise credentials_exception
    except Exception:
        # Não diferencia token malformado, expirado, revogado ou orçamento inexistente.
        raise credentials_exception


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou token expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    raw = extract_bearer_or_cookie(request, token)
    if not raw:
        raise credentials_exception

    payload = decode_token(raw, expected_types={TOKEN_TYPE_ACCESS})
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception

    user = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if user is None or not user.ativo:
        raise credentials_exception
    return user


# Dependência dinâmica para Controle de Acesso Baseado em Roles (RBAC)
class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, user: models.Usuario = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado. Nível de permissão insuficiente para a operação."
            )
        return user


# --- API Keys (autenticação máquina-a-máquina para integrações, ex: extensão do SketchUp) ---

API_KEY_PREFIX_LEN = 12  # inclui o prefixo "ak_" — visível na UI para identificar a chave sem expor o segredo


def hash_api_key(chave: str) -> str:
    return hashlib.sha256(chave.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Gera uma chave nova. Retorna (chave_completa, prefixo_visivel, hash_sha256_hex).
    A chave completa só existe em memória aqui — nunca é persistida em texto puro."""
    chave_completa = f"ak_{secrets.token_urlsafe(32)}"
    prefixo = chave_completa[:API_KEY_PREFIX_LEN]
    return chave_completa, prefixo, hash_api_key(chave_completa)


def get_api_key_identity(
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> models.Usuario:
    """Resolve o header X-API-Key para o Usuario dono da chave. Usada apenas em rotas de
    integração (ex: push de projetos), como alternativa ao JWT de sessão para clientes
    máquina-a-máquina (extensões rodando localmente por longos períodos)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="API key ausente, inválida ou revogada.",
    )
    if not x_api_key or not x_api_key.startswith("ak_") or len(x_api_key) > 128:
        raise credentials_exception

    key_row = db.query(models.ApiKey).filter(
        models.ApiKey.hash_chave == hash_api_key(x_api_key)
    ).first()
    if not key_row or not key_row.ativo or key_row.revoked_at is not None:
        raise credentials_exception

    user = db.query(models.Usuario).filter(models.Usuario.id == key_row.usuario_id).first()
    if not user or not user.ativo:
        raise credentials_exception

    key_row.last_used_at = datetime.now(timezone.utc)
    db.commit()
    return user

# pyrefly: ignore [missing-import]
import pyotp
# pyrefly: ignore [missing-import]
from sendgrid import SendGridAPIClient
# pyrefly: ignore [missing-import]
from sendgrid.helpers.mail import Mail

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "nao-responda@arc-erp.local")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def send_reset_password_email(to_email: str, token: str):
    # Se a chave do SendGrid não for configurada no .env, printamos um mock para dev
    if not SENDGRID_API_KEY or SENDGRID_API_KEY.startswith("SG.sua_chave"):
        print(f"[MOCK EMAIL] Para: {to_email} | Link: {FRONTEND_URL}/reset-password?token={token}")
        return
        
    message = Mail(
        from_email=SENDER_EMAIL,
        to_emails=to_email,
        subject="Recuperação de Senha - ARC ERP",
        html_content=f"<strong>Clique no link para redefinir sua senha:</strong> <br> {FRONTEND_URL}/reset-password?token={token}"
    )
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(message)
    except Exception as e:
        print(f"Erro ao enviar e-mail via SendGrid: {e}")


def send_portal_decision_email(
    to_email: str,
    orcamento_id: int,
    acao: str,
    nome: str,
    motivo: str | None = None,
):
    """Notifica o vendedor sem deixar falha de e-mail quebrar a decisão."""
    nome_seguro = escape(nome)
    acao_texto = "aprovou" if acao == "aprovar" else "recusou"
    motivo_html = f"<p><strong>Motivo:</strong> {escape(motivo)}</p>" if motivo else ""
    if not SENDGRID_API_KEY or SENDGRID_API_KEY.startswith("SG.sua_chave"):
        print(f"[MOCK EMAIL] Para: {to_email} | Cliente {nome} {acao_texto} o orçamento #{orcamento_id}")
        return

    message = Mail(
        from_email=SENDER_EMAIL,
        to_emails=to_email,
        subject=f"Decisão do cliente — orçamento #{orcamento_id}",
        html_content=(
            f"<p>O cliente <strong>{nome_seguro}</strong> {acao_texto} o orçamento "
            f"<strong>#{orcamento_id}</strong>.</p>{motivo_html}"
        ),
    )
    sg = SendGridAPIClient(SENDGRID_API_KEY)
    sg.send(message)


def send_portal_link_email(to_email: str, url: str):
    """Envia o link mágico usando a mesma integração SendGrid do projeto."""
    url_segura = escape(url, quote=True)
    if not SENDGRID_API_KEY or SENDGRID_API_KEY.startswith("SG.sua_chave"):
        print(f"[MOCK EMAIL] Para: {to_email} | Link do portal: {url}")
        return

    message = Mail(
        from_email=SENDER_EMAIL,
        to_emails=to_email,
        subject="Sua proposta está pronta para aprovação — ARC ERP",
        html_content=(
            "<p>Sua proposta está pronta para análise.</p>"
            f'<p><a href="{url_segura}">Abrir proposta no portal</a></p>'
            "<p>Se você não solicitou este link, ignore esta mensagem.</p>"
        ),
    )
    sg = SendGridAPIClient(SENDGRID_API_KEY)
    sg.send(message)
