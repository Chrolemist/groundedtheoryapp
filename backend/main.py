from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from docx import Document
from fastapi import FastAPI, File, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


class DocumentItem(BaseModel):
    id: str
    title: str
    content: str


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

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict) -> None:
        for connection in list(self.active_connections):
            await connection.send_json(message)


app = FastAPI()
manager = ConnectionManager()

in_memory_project = ProjectState()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    await websocket.send_json(in_memory_project.model_dump())
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


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
    document.add_heading("Grounded Theory Analysis Report", level=1)

    document.add_heading("Theory (Selective Coding)", level=2)
    core_category = (
        get_category_by_id(in_memory_project.core_category_id)
        if in_memory_project.core_category_id
        else None
    )
    document.add_paragraph(
        f"Core Category: {core_category.name if core_category else 'Not selected'}"
    )
    document.add_paragraph(in_memory_project.theory_description or "No theory description provided.")

    document.add_heading("Categories (Axial Coding)", level=2)
    for category in in_memory_project.categories:
        document.add_paragraph(category.name, style="List Bullet")
        for code_id in category.contained_code_ids:
            code = get_code_by_id(code_id)
            if code:
                document.add_paragraph(code.name, style="List Bullet 2")

    document.add_heading("Evidence (Open Coding)", level=2)
    for code in in_memory_project.codes:
        document.add_paragraph(code.name, style="List Bullet")
        related_highlights = [
            highlight for highlight in in_memory_project.highlights if highlight.code_id == code.id
        ]
        if not related_highlights:
            document.add_paragraph("No quotes yet.", style="List Bullet 2")
            continue
        for highlight in related_highlights:
            document_item = get_document_by_id(highlight.document_id)
            if not document_item:
                continue
            quote = document_item.content[highlight.start_index : highlight.end_index]
            document.add_paragraph(f'"{quote}"', style="List Bullet 2")

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
                "Document": document_item.title,
                "Quote": quote,
            }
        )

    df = pd.DataFrame(rows or [{"Code": "", "Category": "", "Document": "", "Quote": ""}])
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
