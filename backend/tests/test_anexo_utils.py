"""Testes unitários para validação de anexos e CNPJs de faturamento."""
import io
import sys
import types
from pathlib import Path

import pytest
from fastapi import HTTPException, UploadFile

# Garante import do pacote backend sem carregar database/main
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from anexo_utils import (  # noqa: E402
    ANEXO_MAX_FILE_SIZE,
    cnpjs_configurados,
    read_upload_limited,
    validar_anexo,
)


def test_validar_anexo_pdf_ok():
    validar_anexo(".pdf", b"%PDF-1.4 content")


def test_validar_anexo_webp_exige_header_completo():
    # RIFF sem WEBP deve falhar
    with pytest.raises(HTTPException) as exc:
        validar_anexo(".webp", b"RIFF....XXXX")
    assert exc.value.status_code == 400

    validar_anexo(".webp", b"RIFF\x00\x00\x00\x00WEBP....")


def test_validar_anexo_wav_como_webp_rejeitado():
    # WAV também começa com RIFF
    wav = b"RIFF\x24\x00\x00\x00WAVEfmt "
    with pytest.raises(HTTPException):
        validar_anexo(".webp", wav)


def test_validar_anexo_extensao_negada():
    with pytest.raises(HTTPException) as exc:
        validar_anexo(".exe", b"MZ")
    assert exc.value.status_code == 400


def test_validar_anexo_vazio():
    with pytest.raises(HTTPException) as exc:
        validar_anexo(".txt", b"")
    assert exc.value.status_code == 400


def test_validar_anexo_muito_grande():
    with pytest.raises(HTTPException) as exc:
        validar_anexo(".txt", b"x" * (ANEXO_MAX_FILE_SIZE + 1))
    assert exc.value.status_code == 413


def test_validar_anexo_texto_ok():
    validar_anexo(".csv", b"a,b,c\n1,2,3\n")
    validar_anexo(".txt", b"hello")


def test_validar_anexo_png_ok():
    validar_anexo(".png", b"\x89PNG\r\n\x1a\nrest")


def test_cnpjs_configurados():
    assert cnpjs_configurados(None) == set()

    cfg = types.SimpleNamespace(empresa1_cnpj=" 11.111.111/0001-11 ", empresa2_cnpj=None)
    assert cnpjs_configurados(cfg) == {"11.111.111/0001-11"}

    cfg2 = types.SimpleNamespace(
        empresa1_cnpj="11.111.111/0001-11",
        empresa2_cnpj="22.222.222/0001-22",
    )
    assert cnpjs_configurados(cfg2) == {"11.111.111/0001-11", "22.222.222/0001-22"}


@pytest.mark.asyncio
async def test_read_upload_limited_respeita_teto():
    data = b"a" * 100
    upload = UploadFile(filename="a.txt", file=io.BytesIO(data))
    content = await read_upload_limited(upload, max_size=100)
    assert content == data

    upload2 = UploadFile(filename="b.txt", file=io.BytesIO(b"a" * 101))
    with pytest.raises(HTTPException) as exc:
        await read_upload_limited(upload2, max_size=100)
    assert exc.value.status_code == 413
