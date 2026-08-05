from datetime import timedelta

import pytest
from fastapi import HTTPException

import auth
import models


def _orcamento_fake(**overrides):
    valores = {"id": 42, "portal_token_version": 3}
    valores.update(overrides)
    return models.Orcamento(**valores)


def test_token_portal_carrega_apenas_orcamento_e_versao():
    token = auth.create_portal_token(_orcamento_fake())
    payload = auth.decode_token(token, expected_types={auth.TOKEN_TYPE_PORTAL})

    assert payload["type"] == "portal"
    assert payload["orcamento_id"] == 42
    assert payload["ver"] == 3
    assert "sub" not in payload
    assert "email" not in payload
    assert "nome" not in payload


def test_token_access_e_rejeitado_no_decoder_do_portal():
    token = auth.create_access_token({"sub": "cliente@example.com"})

    with pytest.raises(HTTPException) as exc:
        auth.decode_token(token, expected_types={auth.TOKEN_TYPE_PORTAL})

    assert exc.value.status_code == 401


def test_token_portal_expirado_e_rejeitado():
    token = auth.create_access_token(
        {"type": auth.TOKEN_TYPE_PORTAL, "orcamento_id": 42, "ver": 3},
        expires_delta=timedelta(seconds=-1),
    )

    with pytest.raises(HTTPException) as exc:
        auth.decode_token(token, expected_types={auth.TOKEN_TYPE_PORTAL})

    assert exc.value.status_code == 401
