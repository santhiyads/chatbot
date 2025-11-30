# db.py (improved)
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, func, and_
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./chat_history.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String(64), index=True, nullable=True)
    role = Column(String(20), nullable=False)   # "user" or "bot"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def save_message(role: str, content: str, conversation_id: str | None = None):
    db = SessionLocal()
    try:
        m = ChatMessage(role=role, content=content, conversation_id=conversation_id)
        db.add(m)
        db.commit()
        db.refresh(m)
        return {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "conversation_id": m.conversation_id,
            "created_at": m.created_at.isoformat()
        }
    finally:
        db.close()

def fetch_history(conversation_id: str | None = None, limit: int = 200):
    """
    Returns messages oldest->newest. If conversation_id is None, returns recent messages global.
    """
    db = SessionLocal()
    try:
        q = db.query(ChatMessage)
        if conversation_id:
            q = q.filter(ChatMessage.conversation_id == conversation_id)
        # order by id ascending (oldest first). Use created_at if you prefer.
        rows = q.order_by(ChatMessage.id.asc()).limit(limit).all()
        result = [
            {
                "id": r.id,
                "role": r.role,
                "content": r.content,
                "conversation_id": r.conversation_id,
                "created_at": r.created_at.isoformat() if r.created_at else None
            } for r in rows
        ]
        return result
    finally:
        db.close()

def clear_history(conversation_id: str | None = None):
    """
    Delete messages for a conversation, or all if conversation_id is None.
    Returns number of deleted rows.
    """
    db = SessionLocal()
    try:
        q = db.query(ChatMessage)
        if conversation_id:
            q = q.filter(ChatMessage.conversation_id == conversation_id)
        deleted = q.delete(synchronize_session=False)
        db.commit()
        return {"deleted": deleted}
    finally:
        db.close()

def list_conversations(limit: int = 100):
    """
    Return conversation summaries:
    [{conversation_id, last_message, last_time, count}, ...]
    Excludes NULL conversation_id rows to avoid grouping problems.
    """
    db = SessionLocal()
    try:
        # Subquery: per conversation_id get max(id) and count
        subq = (
            db.query(
                ChatMessage.conversation_id.label("conversation_id"),
                func.max(ChatMessage.id).label("max_id"),
                func.count(ChatMessage.id).label("count")
            )
            .filter(ChatMessage.conversation_id != None)  # exclude NULL
            .group_by(ChatMessage.conversation_id)
            .subquery()
        )

        # join to get the last message row for each conversation
        q = (
            db.query(
                ChatMessage.conversation_id,
                ChatMessage.role,
                ChatMessage.content,
                ChatMessage.created_at,
                subq.c.count
            )
            .join(subq, and_(ChatMessage.conversation_id == subq.c.conversation_id, ChatMessage.id == subq.c.max_id))
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )

        rows = q.all()
        results = []
        for r in rows:
            results.append({
                "conversation_id": r.conversation_id,
                "last_role": r.role,
                "last_message": r.content,
                "last_time": r.created_at.isoformat() if r.created_at else None,
                "count": r.count
            })
        return results
    finally:
        db.close()
