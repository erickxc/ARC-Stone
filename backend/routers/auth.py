from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from database import get_db
import models, auth, schemas
from pydantic import BaseModel
import pyotp

from rate_limiter import _rate_limit_ip, limiter

router = APIRouter(prefix="/auth", tags=["Autenticação"])


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Ambos os cookies são HttpOnly (só o navegador os envia, JS não lê). Isso não impede
    autenticação via <img src>/<a href> same-site — httponly só bloqueia leitura por script,
    não o envio automático do cookie pelo navegador em requisições."""
    import os
    secure = os.getenv("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="Lax",
        max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="Lax",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )


def _issue_session_tokens(user: models.Usuario, response: Response, request: Request, db: Session) -> dict:
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role, "type": auth.TOKEN_TYPE_ACCESS},
        expires_delta=access_token_expires,
    )
    refresh_token = auth.create_access_token(
        data={"sub": user.email, "type": auth.TOKEN_TYPE_REFRESH},
        expires_delta=timedelta(days=7),
    )
    _set_auth_cookies(response, access_token, refresh_token)

    client_ip = request.client.host if request.client else "127.0.0.1"
    client_real_ip = request.headers.get("X-Real-IP", client_ip)
    db.add(models.AuditLog(
        usuario_id=user.id,
        acao="LOGIN",
        detalhes=f"Login realizado por {user.nome} ({user.email})",
        entidade="Usuario",
        entidade_id=user.id,
        ip=client_real_ip,
    ))
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "nome": user.nome,
        "mfa_required": False,
    }


@router.post("/login")
# Autenticação precisa de um balde por IP. Se aceitasse X-API-Key aqui, um
# atacante poderia trocar um header inválido a cada tentativa e escapar do
# limite de senha/MFA/recuperação.
@limiter.limit("5/minute", key_func=_rate_limit_ip)
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(models.Usuario).filter(models.Usuario.email == form_data.username).first()

    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        if user:
            client_ip = request.headers.get("X-Real-IP", request.client.host if request.client else None)
            db.add(models.AuditLog(
                usuario_id=user.id,
                acao="LOGIN_FALHOU",
                detalhes=f"Tentativa de login com senha incorreta para {user.email}",
                entidade="Usuario",
                entidade_id=user.id,
                ip=client_ip,
            ))
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.ativo:
        raise HTTPException(status_code=400, detail="Usuário inativo. Contate o administrador.")

    # MFA obrigatório quando habilitado — não emite access/refresh ainda
    if user.mfa_enabled:
        mfa_token = auth.create_access_token(
            data={"sub": user.email, "type": auth.TOKEN_TYPE_MFA_PENDING},
            expires_delta=timedelta(minutes=5),
        )
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "token_type": "mfa_pending",
        }

    return _issue_session_tokens(user, response, request, db)


class MfaLoginRequest(BaseModel):
    mfa_token: str
    code: str


@router.post("/mfa-login")
@limiter.limit("5/minute", key_func=_rate_limit_ip)
def mfa_login(
    request: Request,
    response: Response,
    body: MfaLoginRequest,
    db: Session = Depends(get_db),
):
    """Completa o login após verificação TOTP (quando MFA está ativo)."""
    payload = auth.decode_token(body.mfa_token, expected_types={auth.TOKEN_TYPE_MFA_PENDING})
    email = payload.get("sub")
    user = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if not user or not user.ativo or not user.mfa_enabled or not user.totp_secret:
        raise HTTPException(status_code=401, detail="Sessão MFA inválida.")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Código de autenticação inválido")

    return _issue_session_tokens(user, response, request, db)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"status": "ok"}


@router.post("/enable-mfa")
def enable_mfa(current_user: models.Usuario = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA já está habilitado para esta conta")

    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    db.commit()

    provisioning_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email,
        issuer_name="ARC ERP",
    )
    return {"secret": secret, "qr_code_url": provisioning_uri}


@router.post("/verify-mfa")
def verify_mfa(code: str, current_user: models.Usuario = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="O MFA ainda não foi gerado para esta conta")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=401, detail="Código de autenticação inválido")

    current_user.mfa_enabled = True
    db.commit()
    return {"status": "MFA ativado e verificado com sucesso"}


class DisableMfaRequest(BaseModel):
    password: str


@router.post("/disable-mfa")
def disable_mfa(body: DisableMfaRequest, current_user: models.Usuario = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """Desativa o MFA da própria conta — exige a senha atual pra confirmar posse da conta
    (evita que uma sessão sequestrada desligue o segundo fator sem provar quem é)."""
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA não está habilitado para esta conta")
    if not auth.verify_password(body.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Senha incorreta")

    current_user.mfa_enabled = False
    current_user.totp_secret = None
    db.commit()
    return {"status": "MFA desativado"}


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
@limiter.limit("5/minute", key_func=_rate_limit_ip)
def forgot_password(request: Request, req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.email == req.email).first()

    if user:
        reset_token = auth.create_access_token(
            data={"sub": user.email, "type": auth.TOKEN_TYPE_RESET, "rtv": user.reset_token_version},
            expires_delta=timedelta(hours=1),
        )
        auth.send_reset_password_email(user.email, reset_token)

    return {"message": "Se o e-mail estiver cadastrado no ARC ERP, você receberá as instruções de recuperação em breve."}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/reset-password")
@limiter.limit("5/minute", key_func=_rate_limit_ip)
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    payload = auth.decode_token(body.token, expected_types={auth.TOKEN_TYPE_RESET})
    email = payload.get("sub")
    user = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido.")
    # Token de uso único: se a versão embutida não bate com a atual do usuário, ou já foi
    # consumido antes, ou foi emitido antes da última troca de senha — nos dois casos, inválido.
    if payload.get("rtv") != user.reset_token_version:
        raise HTTPException(status_code=400, detail="Este link de redefinição já foi usado ou não é mais válido. Solicite um novo.")
    try:
        schemas.validar_complexidade_senha(body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user.hashed_password = auth.get_password_hash(body.new_password)
    user.reset_token_version += 1
    db.commit()
    return {"message": "Senha redefinida com sucesso."}
