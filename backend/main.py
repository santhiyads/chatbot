# main.py
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import os
import asyncio
from model import get_reply
import traceback, logging
from db import init_db, save_message, fetch_history, clear_history, list_conversations
import uuid
logger = logging.getLogger("uvicorn.error")

# Initialize DB tables
init_db()


app = FastAPI(title="Chatbot")

# Allow your React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://chatbot-9tb2-pybtnsk0c-santhiyads-projects.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    save: Optional[bool] = True
    conversation_id: Optional[str] = None  # client may pass it

class ChatResponse(BaseModel):
    reply: str
    conversation_id: Optional[str] = None

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    text = req.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty message")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Message too long (max 2000 chars)")
    
    # Ensure conversation_id exists (client may send or we create one)
    conv_id = req.conversation_id or str(uuid.uuid4())

    # Save user message
    if req.save:
        try:
            save_message("user", text, conversation_id=conv_id)
        except Exception:
            pass  # non-fatal

    try:
        reply = await asyncio.to_thread(get_reply, text)
    except Exception as e:
        # surface a helpful error
        logger.error("Model call failed:\n" + traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Model error: {e}")
    # Save bot reply
    if req.save:
        try:
            save_message("bot", reply, conversation_id=conv_id)
        except Exception:
            pass

    return {"reply": reply, "conversation_id": conv_id}

@app.get("/history")
def history(conversation_id: Optional[str] = Query(None), limit: int = 200):
    """
    GET /history?conversation_id=<id>&limit=200
    If conversation_id not provided, returns recent messages (global).
    """
    try:
        return fetch_history(conversation_id=conversation_id, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

@app.post("/history/clear")
def history_clear(conversation_id: Optional[str] = None):
    """
    POST /history/clear  (optional body param conversation_id)
    Clears all or specific conversation.
    """
    try:
        result = clear_history(conversation_id=conversation_id)
        return {"status": "ok", "detail": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
    
@app.get("/conversations")
def conversations(limit: int = 100):
    """
    Returns list of conversation summaries for the sidebar.
    """
    try:
        return list_conversations(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

@app.get("/conversation/{conv_id}")
def conversation_messages(conv_id: str, limit: int = 500):
    """
    Optionally used if you prefer a dedicated endpoint; reuses fetch_history.
    """
    try:
        return fetch_history(conversation_id=conv_id, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@app.get("/")
def root():
    return {"status": "ok", "message": " Chatbot running"}

