from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import os
import uuid
from auth import get_current_user
from anexo_utils import read_upload_limited

router = APIRouter(prefix="/uploads", tags=["Uploads Rápidos e Seguros"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf", ".webp", ".jfif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Magic bytes para validação real de MIME type
MAGIC_BYTES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG': 'image/png',
    b'%PDF': 'application/pdf',
}

def validate_mime_type(file_bytes: bytes, ext: str | None = None) -> bool:
    """Valida o tipo MIME real do arquivo baseado nos magic bytes (header do arquivo)."""
    if ext == ".webp":
        return len(file_bytes) >= 12 and file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP"
    if ext in (".jpg", ".jpeg", ".jfif"):
        return file_bytes[:3] == b"\xff\xd8\xff"
    if ext == ".png":
        return file_bytes[:4] == b"\x89PNG"
    if ext == ".pdf":
        return file_bytes[:4] == b"%PDF"
    # Sem extensão (ex.: download por URL): aceita magics conhecidos
    if len(file_bytes) >= 12 and file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
        return True
    for magic, _ in MAGIC_BYTES.items():
        if file_bytes[: len(magic)] == magic:
            return True
    return False

@router.post("/")
async def upload_file(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    """
    Recebe arquivos (Fotos do Galpão, Referências de Clientes, PDFs).
    Segurança:
    - Autenticação JWT obrigatória.
    - Validação restrita de extensões.
    - Validação real de MIME type via magic bytes.
    - Limite de tamanho (10MB).
    - Renomeação automática com UUID (previne Path Traversal e colisão).
    """
    filename = file.filename or "uploaded.png"
    ext = os.path.splitext(filename)[1].lower()
    
    if not ext:
        ext = ".png"
        
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Arquivo rejeitado pela segurança. Extensões permitidas: {ALLOWED_EXTENSIONS}")
    
    content = await read_upload_limited(file, MAX_FILE_SIZE)
    
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio não é permitido.")
    
    # Validação real de MIME type via magic bytes
    if not validate_mime_type(content, ext):
        raise HTTPException(
            status_code=400, 
            detail="Tipo de arquivo não permitido. O conteúdo do arquivo não corresponde a uma imagem ou PDF válido."
        )
    
    # Renomeia para um hash único e seguro
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join("uploads", safe_filename)
    
    # Salva o arquivo
    with open(file_path, "wb") as buffer:
        buffer.write(content)
        
    # Retorna o URL estático que pode ser salvo no banco e exibido no React
    return {
        "status": "sucesso", 
        "filename": safe_filename, 
        "url": f"/static/uploads/{safe_filename}"
    }

from pydantic import BaseModel
import requests
from ssrf_utils import assert_public_http_url

class URLUploadRequest(BaseModel):
    url: str

@router.post("/url")
async def upload_from_url(body: URLUploadRequest, current_user = Depends(get_current_user)):
    """
    Faz o download de uma imagem de um site externo e salva localmente.
    Ideal para arrastar e soltar imagens de outras abas.
    """
    url = assert_public_http_url(body.url)

    try:
        # Define um User-Agent para evitar bloqueios básicos
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        response = requests.get(url, headers=headers, timeout=10, stream=True)
        response.raise_for_status()
        # requests segue redirect por padrão — revalida o destino final (anti-SSRF via redirect)
        if response.url != url:
            assert_public_http_url(response.url)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível baixar a imagem deste link.")

    content = response.content
    
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"Arquivo muito grande. Tamanho máximo permitido: {MAX_FILE_SIZE // (1024*1024)}MB")
    
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="O arquivo baixado está vazio.")
        
    if not validate_mime_type(content):
        raise HTTPException(status_code=400, detail="O link não contém uma imagem ou formato válido suportado.")
        
    # Determina a extensão a partir dos magic bytes
    ext = ".png" # padrão
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        ext = ".webp"
    else:
        for magic, mime in MAGIC_BYTES.items():
            if content[:len(magic)] == magic:
                if mime == 'image/jpeg': ext = '.jpg'
                elif mime == 'image/png': ext = '.png'
                elif mime == 'application/pdf': ext = '.pdf'
                break

    safe_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join("uploads", safe_filename)
    
    with open(file_path, "wb") as buffer:
        buffer.write(content)
        
    return {
        "status": "sucesso", 
        "filename": safe_filename, 
        "url": f"/static/uploads/{safe_filename}"
    }
