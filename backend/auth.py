import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("A variável de ambiente SECRET_KEY não está configurada.")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
TOKEN_TYPE_RESET = "reset"
TOKEN_TYPE_MFA_PENDING = "mfa_pending"


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
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


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
