from __future__ import annotations

from io import BytesIO
import os
from pathlib import Path
import json
import logging
from typing import Dict, List, Optional
from uuid import uuid4

import pandas as pd
from docx import Document
from fastapi import FastAPI, File, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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

    def _generate_user_name(self) -> str:
        adjectives = [
            "Curious",
            "Brave",
            "Bright",
            "Quiet",
            "Kind",
            "Swift",
            "Clever",
            "Gentle",
            "Bold",
            "Sunny",
        ]
        animals = [
            "Fox",
            "Otter",
            "Bear",
            "Hawk",
            "Dolphin",
            "Rabbit",
            "Wolf",
            "Deer",
            "Lynx",
            "Panda",
        ]
        base = f"{adjectives[len(self.users) % len(adjectives)]} {animals[len(self.users) % len(animals)]}"
        if base not in {user["name"] for user in self.users.values()}:
            return base
        suffix = 2
        while f"{base} {suffix}" in {user["name"] for user in self.users.values()}:
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

    async def connect(self, websocket: WebSocket) -> Dict[str, str]:
        await websocket.accept()
        self.active_connections.append(websocket)
        user_id = str(uuid4())
        user = {
            "id": user_id,
            "name": self._generate_user_name(),
            "color": self._generate_user_color(),
        }
        self.connection_users[websocket] = user_id
        self.users[user_id] = user
        return user

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        user_id = self.connection_users.pop(websocket, None)
        if user_id and user_id in self.users:
            self.users.pop(user_id, None)

    def get_users(self) -> List[Dict[str, str]]:
        return list(self.users.values())

    async def broadcast(self, message: Dict) -> None:
        for connection in list(self.active_connections):
            await connection.send_json(message)

    async def broadcast_except(self, message: Dict, skip: WebSocket) -> None:
        for connection in list(self.active_connections):
            if connection == skip:
                continue
            await connection.send_json(message)


app = FastAPI()
manager = ConnectionManager()

in_memory_project = ProjectState()
in_memory_project_raw: Dict = {}

allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")


@app.middleware("http")
async def spa_fallback(request: Request, call_next):
    response = await call_next(request)
    if response.status_code != 404:
        return response
    if request.method != "GET":
        return response
    if request.url.path.startswith(("/ws", "/project", "/export")):
        return response
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return response


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
        user = await manager.connect(websocket)
        logger.info(f"WebSocket accepted. User: {user['id']} ({user['name']})")
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
            elif message_type == "project:update" and user_id:
                project_payload = data.get("project", {})
                project_raw = data.get("project_raw") or project_payload
                in_memory_project_raw = project_raw
                in_memory_project = normalize_project_state(project_raw)
                await manager.broadcast(
                    {
                        "type": "project:update",
                        "project": in_memory_project.model_dump(),
                        "project_raw": in_memory_project_raw,
                        "sender_id": user_id,
                    }
                )
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {manager.connection_users.get(websocket)}")
        user_id = manager.connection_users.get(websocket)
        manager.disconnect(websocket)
        await manager.broadcast({"type": "presence:update", "users": manager.get_users()})
        if user_id:
            await manager.broadcast({"type": "cursor:clear", "userId": user_id})


@app.post("/project/load")
async def load_project(file: UploadFile = File(...)) -> Dict[str, str]:
    payload = await file.read()
    project_state = ProjectState.model_validate_json(payload)

    global in_memory_project
    in_memory_project = project_state
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
async def export_word() -> Response:
    document = Document()
    document.add_heading("Grounded Theory Analysrapport", level=1)

    document.add_heading("Teori (Selektiv kodning)", level=2)
    core_category = (
        get_category_by_id(in_memory_project.core_category_id)
        if in_memory_project.core_category_id
        else None
    )
    document.add_paragraph(
        f"Kärnkategori: {core_category.name if core_category else 'Inte vald'}"
    )
    document.add_paragraph(
        in_memory_project.theory_description or "Ingen teoribeskrivning angiven."
    )

    document.add_heading("Kategorier (Axial kodning)", level=2)
    for category in in_memory_project.categories:
        document.add_paragraph(category.name)
        if category.precondition or category.action or category.consequence:
            if category.precondition:
                document.add_paragraph(f"Förutsättning: {category.precondition}")
            if category.action:
                document.add_paragraph(f"Handling: {category.action}")
            if category.consequence:
                document.add_paragraph(f"Konsekvens: {category.consequence}")
        for code_id in category.contained_code_ids:
            code = get_code_by_id(code_id)
            if code:
                document.add_paragraph(f"- {code.name}")

    document.add_heading("Evidens (Öppen kodning)", level=2)
    for code in in_memory_project.codes:
        document.add_paragraph(code.name)
        related_highlights = [
            highlight for highlight in in_memory_project.highlights if highlight.code_id == code.id
        ]
        if not related_highlights:
            document.add_paragraph("Inga citat ännu.")
            continue
        for highlight in related_highlights:
            document_item = get_document_by_id(highlight.document_id)
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
async def export_excel() -> Response:
    rows = []
    code_by_id = {code.id: code for code in in_memory_project.codes}
    category_by_id = {category.id: category for category in in_memory_project.categories}
    categories_by_code: Dict[str, List[str]] = {}
    for category in in_memory_project.categories:
        for code_id in category.contained_code_ids:
            categories_by_code.setdefault(code_id, []).append(category.name)

    for highlight in in_memory_project.highlights:
        code = code_by_id.get(highlight.code_id)
        document_item = get_document_by_id(highlight.document_id)
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
