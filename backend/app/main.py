from contextlib import asynccontextmanager

from beanie import init_beanie
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from .config import settings
from .auth import decode_access_token
from .models import Case, User
from .routers import auth as auth_router
from .routers import cases as cases_router
from .routers import chat as chat_router
from .routers import portal as portal_router
from .ws import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncIOMotorClient(settings.mongodb_uri)
    await init_beanie(database=client[settings.mongodb_db], document_models=[User, Case])
    yield
    client.close()


app = FastAPI(title="incloudy API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(cases_router.router, prefix="/cases", tags=["cases"])
app.include_router(chat_router.router, prefix="/chat", tags=["chat"])
app.include_router(portal_router.router, prefix="/portal", tags=["portal"])


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str) -> None:
    user_id = decode_access_token(token)
    user = await User.get(user_id) if user_id is not None else None
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
