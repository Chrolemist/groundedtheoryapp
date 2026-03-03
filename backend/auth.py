"""Authentication module – user accounts stored in Firestore.

Provides JWT-based auth with register, login, password-reset flows,
and admin CRUD operations on users.
"""

from __future__ import annotations

import logging
import os
import smtplib
import time
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-please")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 h

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@groundedtheory.app")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class RegisterPayload(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: str = ""


class LoginPayload(BaseModel):
    email: str
    password: str


class ForgotPasswordPayload(BaseModel):
    email: str


class ResetPasswordPayload(BaseModel):
    token: str
    password: str = Field(min_length=6)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Firestore helpers
# ---------------------------------------------------------------------------
_firestore_client = None


def _get_firestore():
    """Lazy import – avoids circular dependency with main.py."""
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client
    try:
        from firebase_admin import firestore as _fs
        _firestore_client = _fs.client()
        return _firestore_client
    except Exception:
        logger.exception("Firestore client not available for auth")
        return None


def _users_collection():
    client = _get_firestore()
    if not client:
        return None
    return client.collection("users")


def _get_user_by_email(email: str) -> Optional[Dict]:
    col = _users_collection()
    if not col:
        return None
    docs = col.where("email", "==", email.lower().strip()).limit(1).stream()
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    return None


def _get_user_by_id(user_id: str) -> Optional[Dict]:
    col = _users_collection()
    if not col:
        return None
    doc = col.document(user_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _create_reset_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "purpose": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# Dependency: get current user from Authorization header
# ---------------------------------------------------------------------------

def get_current_user(request: Request) -> Dict:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = _get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin_role(request: Request) -> Dict:
    user = get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Email helper
# ---------------------------------------------------------------------------

def _send_email(to: str, subject: str, html_body: str) -> bool:
    if not SMTP_HOST:
        logger.warning("SMTP not configured – printing reset email to log")
        logger.info("TO: %s | SUBJECT: %s\n%s", to, subject, html_body)
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [to], msg.as_string())
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


# ---------------------------------------------------------------------------
# Routes – public auth
# ---------------------------------------------------------------------------

@router.post("/auth/register")
async def register(payload: RegisterPayload):
    col = _users_collection()
    if not col:
        raise HTTPException(status_code=503, detail="Database unavailable")

    email = payload.email.lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    existing = _get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_id = str(uuid4())
    hashed = pwd_context.hash(payload.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": payload.name.strip() or email.split("@")[0],
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    col.document(user_id).set(user_doc)
    token = _create_access_token(user_id, "user")
    return {
        "ok": True,
        "token": token,
        "user": {
            "id": user_id,
            "email": email,
            "name": user_doc["name"],
            "role": "user",
        },
    }


@router.post("/auth/login")
async def login(payload: LoginPayload):
    email = payload.email.lower().strip()
    user = _get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not pwd_context.verify(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = _create_access_token(user["id"], user.get("role", "user"))
    return {
        "ok": True,
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "role": user.get("role", "user"),
        },
    }


@router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordPayload):
    email = payload.email.lower().strip()
    user = _get_user_by_email(email)
    # Always return OK to prevent email enumeration
    if not user:
        return {"ok": True, "message": "If an account exists, a reset link was sent."}

    reset_token = _create_reset_token(user["id"])
    reset_url = f"{FRONTEND_URL}?reset_token={reset_token}"

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">Reset your password</h2>
        <p>Click the link below to set a new password. The link expires in 1 hour.</p>
        <p><a href="{reset_url}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none">Reset password</a></p>
        <p style="color:#64748b;font-size:13px">If you did not request this, you can safely ignore this email.</p>
    </div>
    """
    _send_email(email, "Password reset – Grounded Theory", html)
    return {"ok": True, "message": "If an account exists, a reset link was sent."}


@router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordPayload):
    data = decode_token(payload.token)
    if not data or data.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user_id = data["sub"]
    col = _users_collection()
    if not col:
        raise HTTPException(status_code=503, detail="Database unavailable")

    doc_ref = col.document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    hashed = pwd_context.hash(payload.password)
    doc_ref.update({"password_hash": hashed})
    return {"ok": True, "message": "Password updated successfully"}


@router.get("/auth/me")
async def get_me(user: Dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
    }


# ---------------------------------------------------------------------------
# Routes – admin CRUD on users
# ---------------------------------------------------------------------------

@router.get("/admin/users")
async def list_users(admin: Dict = Depends(require_admin_role)):
    col = _users_collection()
    if not col:
        raise HTTPException(status_code=503, detail="Database unavailable")
    docs = col.stream()
    users: List[Dict] = []
    for doc in docs:
        data = doc.to_dict()
        users.append({
            "id": doc.id,
            "email": data.get("email", ""),
            "name": data.get("name", ""),
            "role": data.get("role", "user"),
            "created_at": data.get("created_at"),
        })
    return {"users": users}


@router.get("/admin/users/{user_id}")
async def get_user(user_id: str, admin: Dict = Depends(require_admin_role)):
    user = _get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "created_at": user.get("created_at"),
    }


@router.put("/admin/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, admin: Dict = Depends(require_admin_role)):
    col = _users_collection()
    if not col:
        raise HTTPException(status_code=503, detail="Database unavailable")
    doc_ref = col.document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    updates: Dict = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.email is not None:
        email = payload.email.lower().strip()
        # Check uniqueness
        existing = _get_user_by_email(email)
        if existing and existing["id"] != user_id:
            raise HTTPException(status_code=409, detail="Email already in use")
        updates["email"] = email
    if payload.role is not None:
        if payload.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
        updates["role"] = payload.role
    if payload.password is not None:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        updates["password_hash"] = pwd_context.hash(payload.password)

    if updates:
        doc_ref.update(updates)
    return {"ok": True}


@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: Dict = Depends(require_admin_role)):
    col = _users_collection()
    if not col:
        raise HTTPException(status_code=503, detail="Database unavailable")
    doc_ref = col.document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    doc_ref.delete()
    return {"ok": True}


@router.post("/admin/users")
async def admin_create_user(payload: RegisterPayload, admin: Dict = Depends(require_admin_role)):
    """Admin can create a user directly."""
    col = _users_collection()
    if not col:
        raise HTTPException(status_code=503, detail="Database unavailable")

    email = payload.email.lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    existing = _get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_id = str(uuid4())
    hashed = pwd_context.hash(payload.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": payload.name.strip() or email.split("@")[0],
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    col.document(user_id).set(user_doc)
    return {
        "ok": True,
        "user": {
            "id": user_id,
            "email": email,
            "name": user_doc["name"],
            "role": "user",
        },
    }
