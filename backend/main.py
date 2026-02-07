from __future__ import annotations

from io import BytesIO
import os
from pathlib import Path
import json
import logging
import hashlib
import random
from typing import Dict, List, Optional
from uuid import uuid4

import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
from docx import Document
from fastapi import Body, FastAPI, File, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
BUILD_TAG = os.getenv("BUILD_TAG", "local-dev")
logger.info("Build tag: %s", BUILD_TAG)
MAX_PROJECT_BYTES = int(os.getenv("MAX_PROJECT_BYTES", "900000"))
MAX_PROJECT_TOTAL_BYTES = int(os.getenv("MAX_PROJECT_TOTAL_BYTES", "900000000"))


class DocumentItem(BaseModel):
    id: str
    title: str
    content: str
    html: str = ''
    text: str = ''


class CodeItem(BaseModel):
    id: str
    name: str
    color: str


class HighlightItem(BaseModel):
    id: str
    document_id: str
    start_index: int
    end_index: int
    code_id: str


class CategoryItem(BaseModel):
    id: str
    name: str
    contained_code_ids: List[str] = Field(default_factory=list)
    precondition: str = ''
    action: str = ''
    consequence: str = ''


class ProjectState(BaseModel):
    documents: List[DocumentItem] = Field(default_factory=list)
    codes: List[CodeItem] = Field(default_factory=list)
    highlights: List[HighlightItem] = Field(default_factory=list)
    categories: List[CategoryItem] = Field(default_factory=list)
    core_category_id: Optional[str] = None
    theory_description: str = ''


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []
        self.connection_users: Dict[WebSocket, str] = {}
        self.users: Dict[str, Dict[str, str]] = {}
        self.client_users: Dict[str, str] = {}
        self.user_connections: Dict[str, WebSocket] = {}

    def _generate_user_name(self) -> str:
        first_parts = [
            "Busiga",
            "Snälla",
            "Tokiga",
            "Glada",
            "Luriga",
            "Pigga",
            "Coola",
            "Snabba",
            "Mjuka",
            "Kloka",
            "Sköna",
            "Modiga",
        ]
        second_parts = [
            "Räven",
            "Ugglan",
            "Igelkotten",
            "Bävern",
            "Lamasen",
            "Kängurun",
            "Pandan",
            "Humlan",
            "Sälen",
            "Älgen",
            "Vesslan",
            "Grodan",
        ]
        existing = {user["name"] for user in self.users.values()}
        max_attempts = max(20, len(first_parts) * len(second_parts))
        for _ in range(max_attempts):
            base = f"{random.choice(first_parts)} {random.choice(second_parts)}"
            if base not in existing:
                return base
        suffix = 2
        base = f"{first_parts[0]} {second_parts[0]}"
        while f"{base} {suffix}" in existing:
            suffix += 1
        return f"{base} {suffix}"

    def _generate_user_color(self) -> str:
        palette = [
            "#2563EB",
            "#7C3AED",
            "#DC2626",
            "#16A34A",
            "#D97706",
            "#0EA5E9",
            "#DB2777",
            "#0F766E",
        ]
        return palette[len(self.users) % len(palette)]

    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None) -> Dict[str, str]:
        await websocket.accept()
        user_id: Optional[str] = None
        user: Optional[Dict[str, str]] = None

        if client_id:
            existing_user_id = self.client_users.get(client_id)
            if existing_user_id:
                existing_user = self.users.get(existing_user_id)
                old_socket = self.user_connections.get(existing_user_id)
                if old_socket:
                    if old_socket in self.active_connections:
                        self.active_connections.remove(old_socket)
                    self.connection_users.pop(old_socket, None)
                    try:
                        logger.info(
                            "Closing previous socket for client_id=%s user_id=%s",
                            client_id,
                            existing_user_id,
                        )
                        await old_socket.close(code=1000, reason="replaced")
                    except Exception:
                        pass
                if existing_user:
                    user_id = existing_user_id
                    user = existing_user

        if not user_id or not user:
            user_id = str(uuid4())
            user = {
                "id": user_id,
                "name": self._generate_user_name(),
                "color": self._generate_user_color(),
            }

        self.active_connections.append(websocket)
        self.connection_users[websocket] = user_id
        self.users[user_id] = user
        self.user_connections[user_id] = websocket
        if client_id:
            self.client_users[client_id] = user_id
            self.users[user_id]["client_id"] = client_id
        return user

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        user_id = self.connection_users.pop(websocket, None)
        if user_id and user_id in self.users:
            client_id = self.users[user_id].get("client_id")
            self.users.pop(user_id, None)
            self.user_connections.pop(user_id, None)
            if client_id:
                existing = self.client_users.get(client_id)
                if existing == user_id:
                    self.client_users.pop(client_id, None)

    def get_users(self) -> List[Dict[str, str]]:
        return list(self.users.values())

    async def broadcast(self, message: Dict) -> None:
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

    async def broadcast_except(self, message: Dict, skip: WebSocket) -> None:
        for connection in list(self.active_connections):
            if connection == skip:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)


app = FastAPI()
manager = ConnectionManager()

in_memory_project = ProjectState()
in_memory_project_raw: Dict = {}
yjs_update_log: List[str] = []
yjs_update_limit = 200

firestore_client: Optional[firestore.Client] = None
last_saved_project_hash: Dict[str, str] = {}


def get_firestore_client() -> Optional[firestore.Client]:
    global firestore_client
    if firestore_client is not None:
        return firestore_client

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    credentials_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")

    try:
        if not firebase_admin._apps:
            if credentials_json:
                creds_dict = json.loads(credentials_json)
                firebase_admin.initialize_app(credentials.Certificate(creds_dict), {
                    "projectId": project_id or creds_dict.get("project_id"),
                })
            elif credentials_path:
                firebase_admin.initialize_app(credentials.Certificate(credentials_path), {
                    "projectId": project_id,
                })
            else:
                # Use Application Default Credentials (Cloud Run service account)
                firebase_admin.initialize_app(credentials.ApplicationDefault(), {
                    "projectId": project_id,
                })

        firestore_client = firestore.client()
        return firestore_client
    except Exception as exc:
        logger.warning(f"Firestore not configured or failed to initialize: {exc}")
        return None


def get_firestore_doc_ref():
    client = get_firestore_client()
    if not client:
        return None
    collection = os.getenv("FIRESTORE_COLLECTION", "projects")
    doc_id = os.getenv("FIRESTORE_DOC", "default")
    return client.collection(collection).document(doc_id)


def get_project_doc_ref(project_id: str):
    client = get_firestore_client()
    if not client:
        return None
    collection = os.getenv("FIRESTORE_COLLECTION", "projects")
    return client.collection(collection).document(project_id)


def compute_project_hash(project_raw: Dict) -> Optional[str]:
    try:
        if isinstance(project_raw, dict) and "updated_at" in project_raw:
            sanitized = dict(project_raw)
            sanitized.pop("updated_at", None)
        else:
            sanitized = project_raw
        payload = json.dumps(sanitized, sort_keys=True, separators=(",", ":"))
    except Exception:
        return None
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def estimate_project_bytes(project_raw: Dict) -> Optional[int]:
    try:
        payload = json.dumps(project_raw, sort_keys=True, separators=(",", ":"))
    except Exception:
        return None
    return len(payload.encode("utf-8"))


def validate_project_limits(project_raw: Dict) -> Optional[Dict[str, str]]:
    size_bytes = estimate_project_bytes(project_raw)
    if size_bytes is None:
        return {
            "reason": "project_invalid",
            "message": "Project payload could not be serialized.",
        }
    if MAX_PROJECT_BYTES > 0 and size_bytes > MAX_PROJECT_BYTES:
        return {
            "reason": "project_too_large",
            "message": (
                f"Project size {size_bytes} bytes exceeds limit {MAX_PROJECT_BYTES} bytes."
            ),
        }
    if MAX_PROJECT_TOTAL_BYTES > 0 and size_bytes > MAX_PROJECT_TOTAL_BYTES:
        return {
            "reason": "project_total_limit_reached",
            "message": (
                f"Project total size {size_bytes} bytes exceeds limit {MAX_PROJECT_TOTAL_BYTES} bytes."
            ),
        }
    return None


def save_project_to_firestore(project_raw: Dict, project_id: Optional[str] = None) -> None:
    global last_saved_project_hash
    doc_ref = get_project_doc_ref(project_id) if project_id else get_firestore_doc_ref()
    if not doc_ref:
        return
    current_hash = compute_project_hash(project_raw)
    hash_key = project_id or "default"
    if current_hash and current_hash == last_saved_project_hash.get(hash_key):
        return
    try:
        doc_ref.set(
            {
                "project": project_raw,
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        if current_hash:
            last_saved_project_hash[hash_key] = current_hash
    except Exception as exc:
        logger.warning(f"Failed to save project to Firestore: {exc}")


def load_project_from_firestore(project_id: Optional[str] = None) -> Optional[Dict]:
    doc_ref = get_project_doc_ref(project_id) if project_id else get_firestore_doc_ref()
    if not doc_ref:
        return None
    try:
        snapshot = doc_ref.get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}
        return data.get("project")
    except Exception as exc:
        logger.warning(f"Failed to load project from Firestore: {exc}")
        return None


def serialize_project_summary(snapshot) -> Dict[str, Optional[str]]:
    data = snapshot.to_dict() or {}
    name = data.get("name") or "Untitled project"
    updated_at = data.get("updated_at")
    created_at = data.get("created_at")
    def to_iso(value):
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return None
    return {
        "id": snapshot.id,
        "name": name,
        "updated_at": to_iso(updated_at),
        "created_at": to_iso(created_at),
    }

allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def load_persisted_project() -> None:
    global in_memory_project
    global in_memory_project_raw
    global last_saved_project_hash
    project_raw = load_project_from_firestore()
    if project_raw:
        in_memory_project_raw = project_raw
        in_memory_project = normalize_project_state(project_raw)
        project_hash = compute_project_hash(project_raw)
        if project_hash:
            last_saved_project_hash["default"] = project_hash
        logger.info("Loaded project from Firestore")

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

# Mount assets explicitly to avoid intercepting root requests (and WebSockets)
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


def get_code_by_id(code_id: str) -> Optional[CodeItem]:
    return next((code for code in in_memory_project.codes if code.id == code_id), None)


def get_category_by_id(category_id: str) -> Optional[CategoryItem]:
    return next(
        (category for category in in_memory_project.categories if category.id == category_id),
        None,
    )


def get_document_by_id(document_id: str) -> Optional[DocumentItem]:
    return next(
        (document for document in in_memory_project.documents if document.id == document_id),
        None,
    )


def normalize_project_state(payload: Dict) -> ProjectState:
    documents = []
    for doc in payload.get("documents", []):
        content = doc.get("content") or doc.get("text") or ""
        documents.append(
            DocumentItem(
                id=doc.get("id", ""),
                title=doc.get("title", ""),
                content=content,
                html=doc.get("html", ""),
                text=doc.get("text", ""),
            )
        )

    categories = []
    for category in payload.get("categories", []):
        categories.append(
            CategoryItem(
                id=category.get("id", ""),
                name=category.get("name", ""),
                contained_code_ids=category.get("contained_code_ids", [])
                or category.get("codeIds", []),
                precondition=category.get("precondition", ""),
                action=category.get("action", ""),
                consequence=category.get("consequence", ""),
            )
        )

    return ProjectState(
        documents=documents,
        codes=[
            CodeItem(
                id=code.get("id", ""),
                name=code.get("name") or code.get("label") or "",
                color=code.get("color") or code.get("colorHex") or "#E2E8F0",
            )
            for code in payload.get("codes", [])
        ],
        highlights=[
            HighlightItem(
                id=highlight.get("id", ""),
                document_id=highlight.get("document_id", ""),
                start_index=highlight.get("start_index", 0),
                end_index=highlight.get("end_index", 0),
                code_id=highlight.get("code_id", ""),
            )
            for highlight in payload.get("highlights", [])
        ],
        categories=categories,
        core_category_id=payload.get("core_category_id")
        or payload.get("coreCategoryId"),
        theory_description=payload.get("theory_description", "")
        or payload.get("theoryHtml", ""),
    )


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    logger.info("New WebSocket connection request")
    global in_memory_project
    global in_memory_project_raw
    try:
        client_id = websocket.query_params.get("client_id")
        user = await manager.connect(websocket, client_id)
        user_agent = websocket.headers.get("user-agent")
        origin = websocket.headers.get("origin")
        logger.info(
            "WebSocket accepted. User: %s (%s) client_id=%s remote=%s ua=%s origin=%s",
            user["id"],
            user["name"],
            client_id,
            websocket.client,
            user_agent,
            origin,
        )
    except Exception as e:
        logger.error(f"WebSocket connection failed: {e}")
        return

    await websocket.send_json(
        {
            "type": "hello",
            "user": user,
            "users": manager.get_users(),
            "project": in_memory_project.model_dump(),
            "project_raw": in_memory_project_raw or None,
        }
    )
    if yjs_update_log:
        await websocket.send_json({"type": "yjs:sync", "updates": yjs_update_log})
    await manager.broadcast({"type": "presence:update", "users": manager.get_users()})
    try:
        while True:
            raw = await websocket.receive_text()
            # logger.debug(f"Received message: {raw[:100]}...")  # Optional: Log incoming messages
            try:
                data = json.loads(raw)
            except Exception:
                continue

            message_type = data.get("type")
            user_id = manager.connection_users.get(websocket)
            if message_type == "ping":
                await websocket.send_json({"type": "pong", "ts": data.get("ts")})
                continue
            if message_type == "presence:rename" and user_id:
                next_name = str(data.get("name", "")).strip()
                if next_name:
                    manager.users[user_id]["name"] = next_name[:40]
                    await manager.broadcast(
                        {"type": "presence:update", "users": manager.get_users()}
                    )
            elif message_type == "cursor:update" and user_id:
                payload = {
                    "type": "cursor:update",
                    "userId": user_id,
                    "cursor": data.get("cursor"),
                }
                await manager.broadcast_except(payload, websocket)
            elif message_type == "cursor:clear" and user_id:
                await manager.broadcast_except(
                    {"type": "cursor:clear", "userId": user_id}, websocket
                )
            elif message_type == "selection:update" and user_id:
                payload = {
                    "type": "selection:update",
                    "userId": user_id,
                    "selection": data.get("selection"),
                }
                await manager.broadcast_except(payload, websocket)
            elif message_type == "selection:clear" and user_id:
                await manager.broadcast_except(
                    {"type": "selection:clear", "userId": user_id}, websocket
                )
            elif message_type == "yjs:update" and user_id:
                update = data.get("update")
                if update:
                    yjs_update_log.append(update)
                    if len(yjs_update_log) > yjs_update_limit:
                        yjs_update_log[:] = yjs_update_log[-yjs_update_limit:]
                    await manager.broadcast_except(
                        {
                            "type": "yjs:update",
                            "update": update,
                        },
                        websocket,
                    )
            elif message_type == "project:update" and user_id:
                project_payload = data.get("project", {})
                project_raw = data.get("project_raw") or project_payload
                if isinstance(project_raw, dict):
                    limit_error = validate_project_limits(project_raw)
                    if limit_error:
                        await websocket.send_json(
                            {
                                "type": "project:save:error",
                                **limit_error,
                            }
                        )
                        continue
                in_memory_project_raw = project_raw
                in_memory_project = normalize_project_state(project_raw)
                save_project_to_firestore(in_memory_project_raw)
                await manager.broadcast(
                    {
                        "type": "project:update",
                        "project": in_memory_project.model_dump(),
                        "project_raw": in_memory_project_raw,
                        "sender_id": user_id,
                    }
                )
    except WebSocketDisconnect as exc:
        user_agent = websocket.headers.get("user-agent")
        origin = websocket.headers.get("origin")
        logger.info(
            "WebSocket disconnected: %s (code=%s) client_id=%s remote=%s ua=%s origin=%s",
            manager.connection_users.get(websocket),
            getattr(exc, "code", None),
            client_id,
            websocket.client,
            user_agent,
            origin,
        )
        user_id = manager.connection_users.get(websocket)
        manager.disconnect(websocket)
        await manager.broadcast({"type": "presence:update", "users": manager.get_users()})
        if user_id:
            await manager.broadcast({"type": "cursor:clear", "userId": user_id})
            await manager.broadcast({"type": "selection:clear", "userId": user_id})


@app.get("/project/state")
async def get_project_state() -> Dict[str, Optional[Dict]]:
    global in_memory_project
    global in_memory_project_raw
    global last_saved_project_hash
    project_raw = load_project_from_firestore()
    if project_raw:
        in_memory_project_raw = project_raw
        in_memory_project = normalize_project_state(project_raw)
        project_hash = compute_project_hash(project_raw)
        if project_hash:
            last_saved_project_hash["default"] = project_hash
    elif not in_memory_project_raw and in_memory_project.documents:
        in_memory_project_raw = in_memory_project.model_dump()
        project_hash = compute_project_hash(in_memory_project_raw)
        if project_hash:
            last_saved_project_hash["default"] = project_hash

    return {
        "project_raw": in_memory_project_raw or None,
        "project": in_memory_project.model_dump(),
    }


@app.get("/projects")
async def list_projects() -> Dict[str, List[Dict[str, Optional[str]]]]:
    client = get_firestore_client()
    if not client:
        return {"projects": []}
    collection = os.getenv("FIRESTORE_COLLECTION", "projects")
    try:
        query = client.collection(collection).order_by(
            "updated_at", direction=firestore.Query.DESCENDING
        )
        snapshots = query.stream()
        return {"projects": [serialize_project_summary(doc) for doc in snapshots]}
    except Exception as exc:
        logger.warning(f"Failed to list projects: {exc}")
        return {"projects": []}


@app.post("/projects")
async def create_project(payload: Dict = Body(...)) -> Dict[str, Optional[Dict]]:
    client = get_firestore_client()
    if not client:
        return {"status": "error", "message": "Firestore not available"}
    name = str(payload.get("name") or "New project").strip() or "New project"
    project_raw = payload.get("project_raw")
    if not isinstance(project_raw, dict):
        project_raw = {
            "documents": [],
            "codes": [],
            "categories": [],
            "memos": [],
            "coreCategoryId": "",
            "theoryHtml": "",
        }
    limit_error = validate_project_limits(project_raw)
    if limit_error:
        return {
            "status": "error",
            **limit_error,
        }
    project_id = str(uuid4())
    doc_ref = get_project_doc_ref(project_id)
    if not doc_ref:
        return {"status": "error", "message": "Firestore not available"}
    doc_ref.set(
        {
            "name": name,
            "project": project_raw,
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )
    return {
        "project_id": project_id,
        "project_raw": project_raw,
        "name": name,
    }


@app.get("/projects/{project_id}")
async def get_project(project_id: str) -> Dict[str, Optional[Dict]]:
    doc_ref = get_project_doc_ref(project_id)
    if not doc_ref:
        return {"status": "error", "message": "Firestore not available"}
    try:
        snapshot = doc_ref.get()
        if not snapshot.exists:
            return {"status": "not_found"}
        data = snapshot.to_dict() or {}
        return {
            "project_raw": data.get("project") or None,
            "project": normalize_project_state(data.get("project") or {}).model_dump(),
            "name": data.get("name") or "Untitled project",
        }
    except Exception as exc:
        logger.warning(f"Failed to load project: {exc}")
        return {"status": "error", "message": "Failed to load project"}


@app.patch("/projects/{project_id}")
async def rename_project(project_id: str, payload: Dict = Body(...)) -> Dict[str, str]:
    doc_ref = get_project_doc_ref(project_id)
    if not doc_ref:
        return {"status": "error", "message": "Firestore not available"}
    name = str(payload.get("name") or "").strip()
    if not name:
        return {"status": "invalid", "message": "Project name is required"}
    try:
        doc_ref.set(
            {
                "name": name,
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return {"status": "ok", "name": name}
    except Exception as exc:
        logger.warning(f"Failed to rename project: {exc}")
        return {"status": "error", "message": "Failed to rename project"}


@app.delete("/projects/{project_id}")
async def delete_project(project_id: str) -> Dict[str, str]:
    global last_saved_project_hash
    doc_ref = get_project_doc_ref(project_id)
    if not doc_ref:
        return {"status": "error", "message": "Firestore not available"}
    try:
        doc_ref.delete()
        last_saved_project_hash.pop(project_id, None)
        return {"status": "ok"}
    except Exception as exc:
        logger.warning(f"Failed to delete project: {exc}")
        return {"status": "error", "message": "Failed to delete project"}


@app.post("/projects/{project_id}/state")
async def set_project_state_for_project(project_id: str, payload: Dict = Body(...)) -> Dict[str, str]:
    global in_memory_project
    global in_memory_project_raw
    global last_saved_project_hash

    try:
        project_raw = payload.get("project_raw") or payload.get("project") or payload
        project_name = payload.get("name")
        if not isinstance(project_raw, dict):
            return {"status": "invalid"}

        limit_error = validate_project_limits(project_raw)
        if limit_error:
            return {
                "status": "error",
                **limit_error,
            }

        in_memory_project_raw = project_raw
        in_memory_project = normalize_project_state(project_raw)
        save_project_to_firestore(in_memory_project_raw, project_id=project_id)
        if project_name:
            doc_ref = get_project_doc_ref(project_id)
            if doc_ref:
                doc_ref.set({"name": project_name}, merge=True)
        project_hash = compute_project_hash(in_memory_project_raw)
        if project_hash:
            last_saved_project_hash[project_id] = project_hash
        return {"status": "ok"}
    except Exception:
        logger.exception("Failed to save project state")
        return {"status": "error"}


@app.post("/project/state")
async def set_project_state(payload: Dict = Body(...)) -> Dict[str, str]:
    global in_memory_project
    global in_memory_project_raw
    global last_saved_project_hash

    try:
        project_raw = payload.get("project_raw") or payload.get("project") or payload
        if not isinstance(project_raw, dict):
            return {"status": "invalid"}

        limit_error = validate_project_limits(project_raw)
        if limit_error:
            return {
                "status": "error",
                **limit_error,
            }

        in_memory_project_raw = project_raw
        in_memory_project = normalize_project_state(project_raw)
        save_project_to_firestore(in_memory_project_raw)
        project_hash = compute_project_hash(in_memory_project_raw)
        if project_hash:
            last_saved_project_hash["default"] = project_hash
        await manager.broadcast(
            {
                "type": "project:update",
                "project": in_memory_project.model_dump(),
                "project_raw": in_memory_project_raw,
            }
        )
        return {"status": "ok"}
    except Exception as exc:
        logger.exception("Failed to save project state")
        return {"status": "error"}


@app.post("/project/load")
async def load_project(file: UploadFile = File(...)) -> Dict[str, str]:
    payload = await file.read()
    project_state = ProjectState.model_validate_json(payload)

    global in_memory_project
    global in_memory_project_raw
    global last_saved_project_hash
    in_memory_project = project_state
    in_memory_project_raw = project_state.model_dump()
    limit_error = validate_project_limits(in_memory_project_raw)
    if limit_error:
        return {
            "status": "error",
            **limit_error,
        }
    save_project_to_firestore(project_state.model_dump())
    project_hash = compute_project_hash(in_memory_project_raw)
    if project_hash:
        last_saved_project_hash["default"] = project_hash
    await manager.broadcast(in_memory_project.model_dump())

    return {"status": "ok"}


@app.get("/project/save")
async def save_project() -> Response:
    content = in_memory_project.model_dump_json(indent=2)
    headers = {
        "Content-Disposition": "attachment; filename=project_backup.json",
    }
    return Response(content=content, media_type="application/json", headers=headers)


@app.get("/export/word")
async def export_word(project_id: Optional[str] = None) -> Response:
    project_raw = load_project_from_firestore(project_id) if project_id else None
    project = normalize_project_state(project_raw) if project_raw else in_memory_project
    document = Document()
    document.add_heading("Grounded Theory Analysrapport", level=1)

    document.add_heading("Teori (Selektiv kodning)", level=2)
    def get_code_by_id_local(code_id: str) -> Optional[CodeItem]:
        return next((code for code in project.codes if code.id == code_id), None)

    def get_category_by_id_local(category_id: str) -> Optional[CategoryItem]:
        return next((category for category in project.categories if category.id == category_id), None)

    def get_document_by_id_local(document_id: str) -> Optional[DocumentItem]:
        return next((doc for doc in project.documents if doc.id == document_id), None)

    core_category = (
        get_category_by_id_local(project.core_category_id)
        if project.core_category_id
        else None
    )
    document.add_paragraph(
        f"Kärnkategori: {core_category.name if core_category else 'Inte vald'}"
    )
    document.add_paragraph(
        project.theory_description or "Ingen teoribeskrivning angiven."
    )

    document.add_heading("Kategorier (Axial kodning)", level=2)
    for category in project.categories:
        document.add_paragraph(category.name)
        if category.precondition or category.action or category.consequence:
            if category.precondition:
                document.add_paragraph(f"Förutsättning: {category.precondition}")
            if category.action:
                document.add_paragraph(f"Handling: {category.action}")
            if category.consequence:
                document.add_paragraph(f"Konsekvens: {category.consequence}")
        for code_id in category.contained_code_ids:
            code = get_code_by_id_local(code_id)
            if code:
                document.add_paragraph(f"- {code.name}")

    document.add_heading("Evidens (Öppen kodning)", level=2)
    for code in project.codes:
        document.add_paragraph(code.name)
        related_highlights = [highlight for highlight in project.highlights if highlight.code_id == code.id]
        if not related_highlights:
            document.add_paragraph("Inga citat ännu.")
            continue
        for highlight in related_highlights:
            document_item = get_document_by_id_local(highlight.document_id)
            if not document_item:
                continue
            quote = document_item.content[highlight.start_index : highlight.end_index]
            document.add_paragraph(f'"{quote}"')

    output = BytesIO()
    document.save(output)
    output.seek(0)

    headers = {
        "Content-Disposition": "attachment; filename=grounded_theory_report.docx",
    }
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers,
    )


@app.get("/export/excel")
async def export_excel(project_id: Optional[str] = None) -> Response:
    project_raw = load_project_from_firestore(project_id) if project_id else None
    project = normalize_project_state(project_raw) if project_raw else in_memory_project
    rows = []
    code_by_id = {code.id: code for code in project.codes}
    category_by_id = {category.id: category for category in project.categories}
    categories_by_code: Dict[str, List[str]] = {}
    for category in project.categories:
        for code_id in category.contained_code_ids:
            categories_by_code.setdefault(code_id, []).append(category.name)

    for highlight in project.highlights:
        code = code_by_id.get(highlight.code_id)
        document_item = next((doc for doc in project.documents if doc.id == highlight.document_id), None)
        if not code or not document_item:
            continue
        quote = document_item.content[highlight.start_index : highlight.end_index]
        rows.append(
            {
                "Code": code.name,
                "Category": ", ".join(categories_by_code.get(code.id, [])),
                "Förutsättning": "; ".join(
                    filter(
                        None,
                        [
                            category_by_id[category_id].precondition
                            for category_id in category_by_id
                            if code.id in category_by_id[category_id].contained_code_ids
                        ],
                    )
                ),
                "Handling": "; ".join(
                    filter(
                        None,
                        [
                            category_by_id[category_id].action
                            for category_id in category_by_id
                            if code.id in category_by_id[category_id].contained_code_ids
                        ],
                    )
                ),
                "Konsekvens": "; ".join(
                    filter(
                        None,
                        [
                            category_by_id[category_id].consequence
                            for category_id in category_by_id
                            if code.id in category_by_id[category_id].contained_code_ids
                        ],
                    )
                ),
                "Dokument": document_item.title,
                "Citat": quote,
            }
        )

    df = pd.DataFrame(
        rows
        or [
            {
                "Code": "",
                "Category": "",
                "Förutsättning": "",
                "Handling": "",
                "Konsekvens": "",
                "Dokument": "",
                "Citat": "",
            }
        ]
    )
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Grounded Theory")
    output.seek(0)

    headers = {
        "Content-Disposition": "attachment; filename=grounded_theory_report.xlsx",
    }
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


# Catch-all route for SPA - must be defined LAST
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # If the file exists in dist (e.g. favicon.ico, manifest.json), serve it
    possible_file = FRONTEND_DIST / full_path
    if possible_file.is_file():
        return FileResponse(possible_file)

    # Otherwise serve index.html for client-side routing
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    
    return Response("Frontend not found. Did you run 'npm run build'?", status_code=404)
