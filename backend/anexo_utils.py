"""Utilitários de anexos de orçamento: validação e leitura limitada."""
from __future__ import annotations

import os

from fastapi import HTTPException, UploadFile

ANEXO_ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".xlsx", ".pptx", ".doc", ".xls",
    ".csv", ".txt", ".jpg", ".jpeg", ".png", ".webp",
}
# Alinhado ao client_max_body_size do Nginx (16M) com margem
ANEXO_MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

ANEXO_MAGIC_BYTES = {
    b"%PDF": {".pdf"},
    b"PK\x03\x04": {".docx", ".xlsx", ".pptx"},
    b"\xd0\xcf\x11\xe0": {".doc", ".xls"},
    b"\xff\xd8\xff": {".jpg", ".jpeg"},
    b"\x89PNG": {".png"},
}
ANEXO_TEXT_EXTENSIONS = {".csv", ".txt"}

ANEXO_PRIVATE_DIR = os.path.join("uploads_private", "anexos")


def validar_anexo(ext: str, content: bytes) -> None:
    if ext not in ANEXO_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extensão não permitida. Aceitas: {', '.join(sorted(ANEXO_ALLOWED_EXTENSIONS))}",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio não é permitido.")
    if len(content) > ANEXO_MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo muito grande. Máximo: {ANEXO_MAX_FILE_SIZE // (1024 * 1024)}MB",
        )
    if ext in ANEXO_TEXT_EXTENSIONS:
        return
    # WebP: RIFF....WEBP (bytes 8-12)
    if ext == ".webp":
        if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
            return
        raise HTTPException(
            status_code=400,
            detail="O conteúdo do arquivo não corresponde à extensão informada.",
        )
    for magic, exts in ANEXO_MAGIC_BYTES.items():
        if content[: len(magic)] == magic and ext in exts:
            return
    raise HTTPException(
        status_code=400,
        detail="O conteúdo do arquivo não corresponde à extensão informada.",
    )


async def read_upload_limited(file: UploadFile, max_size: int = ANEXO_MAX_FILE_SIZE) -> bytes:
    """Lê o upload em chunks e aborta se ultrapassar max_size (evita carregar payload gigante na memória)."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"Arquivo muito grande. Máximo: {max_size // (1024 * 1024)}MB",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def ensure_anexo_dir() -> str:
    os.makedirs(ANEXO_PRIVATE_DIR, exist_ok=True)
    return ANEXO_PRIVATE_DIR


def anexo_disk_path(url_or_name: str) -> str:
    """Resolve caminho no disco (privado novo ou legado em uploads/)."""
    name = os.path.basename(url_or_name)
    private = os.path.join(ANEXO_PRIVATE_DIR, name)
    if os.path.exists(private):
        return private
    legacy = os.path.join("uploads", name)
    return legacy


def cnpjs_configurados(config) -> set[str]:
    """Retorna o conjunto de CNPJs de faturamento configurados (normalizados)."""
    cnpjs: set[str] = set()
    if not config:
        return cnpjs
    for attr in ("empresa1_cnpj", "empresa2_cnpj"):
        val = getattr(config, attr, None)
        if val and str(val).strip():
            cnpjs.add(str(val).strip())
    return cnpjs
