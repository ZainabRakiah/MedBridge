"""MedBridge — QR code generation with HMAC-signed tokens (no raw PHI in QR payload)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import time
import uuid

import qrcode
from qrcode.image.pure import PyPNGImage

from config.settings import QR_HMAC_SECRET, QR_TOKEN_TTL_SECONDS
from models.triage import QRToken, TriageCard


def _sign_token(payload: dict) -> str:
    """Create HMAC-SHA256 signature for a token payload."""
    message = json.dumps(payload, sort_keys=True).encode()
    sig = hmac.new(QR_HMAC_SECRET.encode(), message, hashlib.sha256).hexdigest()
    return sig


def _encode_token(payload: dict) -> str:
    """Base64-encode a signed token payload."""
    payload_bytes = json.dumps(payload).encode()
    return base64.urlsafe_b64encode(payload_bytes).decode()


def _decode_token(token_str: str) -> dict | None:
    """Decode and verify a QR token."""
    try:
        payload = json.loads(base64.urlsafe_b64decode(token_str + "=="))
        sig = payload.pop("sig", None)
        expected_sig = _sign_token(payload)
        if not hmac.compare_digest(sig or "", expected_sig):
            return None
        if time.time() > payload.get("exp", 0):
            return None
        return payload
    except Exception:
        return None


def generate_qr_token(triage_card: TriageCard, base_url: str = "http://localhost:3000") -> QRToken:
    """Generate a secure QR token for the triage card.
    
    The QR code contains ONLY:
    - A record_id (opaque UUID, no PHI)
    - An expiry timestamp
    - An HMAC signature
    
    No patient name, medications, or medical data is embedded in the QR payload.
    """
    record_id = str(uuid.uuid4())
    expires_at = int(time.time()) + QR_TOKEN_TTL_SECONDS

    # Token payload — ONLY identifiers, no PHI
    payload = {
        "rid": record_id,
        "exp": expires_at,
        "iss": "medbridge",
    }
    payload["sig"] = _sign_token(payload)

    token_str = _encode_token(payload)

    # QR resolves to: {base_url}/triage/view?token={token_str}
    qr_url = f"{base_url}/triage/view?token={token_str}"

    # Generate QR image
    qr_img_b64 = _generate_qr_image(qr_url)

    expires_dt = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(expires_at))

    return QRToken(
        token=token_str,
        expires_at=expires_dt,
        record_id=record_id,
        qr_image_base64=qr_img_b64,
    )


def _generate_qr_image(data: str) -> str:
    """Generate a QR code and return as base64-encoded PNG."""
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=8,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#0f172a", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()
    except Exception:
        # Fallback: return empty if qrcode fails
        return ""


def verify_qr_token(token_str: str) -> dict | None:
    """Verify a QR token and return the payload if valid."""
    return _decode_token(token_str)
