# AI Chatbot 
React frontend + FastAPI backend — local dev & deploy instructions, API docs, troubleshooting and tips.

Project overview

A simple AI chatbot with:

React frontend (chat UI, sidebar conversation history)

FastAPI backend (chat endpoint, history, conversations)

AI model integration via Groq (Llama 3.1 instant)

SQLite DB (SQLAlchemy) for conversation & message history

Endpoints:

POST /chat — send message, returns reply and conversation_id

GET /history — get messages (optionally by conversation_id)

POST /history/clear — clear a conversation or global history

GET /conversations — list conversation summaries

GET /conversation/{conv_id} — fetch messages for one conversation

This repo: https://github.com/santhiyads/chatbot.

Quick start (recommended, local dev)
1. Clone
git clone https://github.com/santhiyads/chatbot.git
cd chatbot

2. Backend (Python / FastAPI)

Create and activate a virtual environment:

# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# macOS / Linux
python3 -m venv venv
source venv/bin/activate


Install backend requirements (example requirements.txt):

fastapi
uvicorn[standard]
python-dotenv
sqlalchemy
pydantic
groq  # if using groq client (install whatever client library your provider uses)


Install:

pip install -r requirements.txt


Create .env in backend/ (or project root if backend reads it) with your keys:

GROQ_API_KEY=sk-xxxxxx
DATABASE_URL=sqlite:///./chat_history.db   # optional: default is used if missing


Start backend:

# from backend/ or project root if main imports correctly
uvicorn main:app --reload --host 0.0.0.0 --port 8000


Open http://127.0.0.1:8000
 — you should see {"status":"ok","message":" Chatbot running"}.

Notes:

init_db() is called at startup (creates chat_history.db if using sqlite).

If you see ImportError about missing symbols from db.py, ensure db.py and main.py are in the same folder and module names match.

3. Frontend (React)

Open a new terminal, go to the frontend folder:

cd frontend
npm install
npm start


Open http://localhost:3000
.

If your backend runs at a different host/port, update API_BASE in src/App.js (or use .env for the frontend).

API (examples)
POST /chat

Request:

POST /chat
Content-Type: application/json

{
  "message": "Hello",
  "conversation_id": "optional-conv-id"
}


Response:

{
  "reply": "Hi there!",
  "conversation_id": "generated-or-passed-id"
}

GET /history

GET /history → returns recent messages (global)

GET /history?conversation_id=<id>&limit=100 → returns conversation messages

POST /history/clear

POST /history/clear?conversation_id=<id> → clears that conv

POST /history/clear → clears all (use with caution!)

GET /conversations

Returns conversation summaries (id, last message, last_time, count)

Data model and db.py behavior

ChatMessage model: id, conversation_id, role, content, created_at.

save_message(role, content, conversation_id) used by /chat.

fetch_history(conversation_id, limit) returns messages chronological (old → new).

list_conversations(limit) returns {conversation_id, last_message, last_time, count} — used to build the sidebar.

init_db() uses Base.metadata.create_all() — no migration tool required for simple schema.

Frontend notes (App.js & Sidebar)

Frontend stores a conv_id in localStorage after the first chat reply (so subsequent messages include conversation_id).

Sidebar should call /conversations once on mount, list conversations, and call /conversation/{id} or /history?conversation_id= to load messages into the chat area.

Typical flow:

User opens app → Sidebar requests /conversations.

User clicks a conversation → frontend calls /history?conversation_id=<id> and renders bubble UI.

When user sends a message, include conversation_id in body to /chat; backend will persist message and return reply + conv id.

If you see duplicate conversation listing or duplicate network calls:

Ensure useEffect in Sidebar or App doesn't call the fetch function twice (e.g., once in Sidebar and again in App on mount).

Avoid triggering fetch on both mount and on a parent re-render that runs again. Use dependency arrays ([]) and memoize functions or use a single centralized fetch.

Troubleshooting — common issues you encountered & fixes
1. TypeError: 'ChatCompletionMessage' object is not subscriptable

When reading Groq response: do not index message like a dict. Instead use attribute .content or hasattr(msg, "content"). Example:

choice = response.choices[0]
msg = choice.message
if hasattr(msg, "content"):
    text = msg.content
else:
    text = str(msg)


(You already handled this in model.py.)

2. npx not found on Windows

Install Node.js (which includes npx) or run npm init react-app alternatives. If Node is installed but npx not found, re-open terminal or add Node to PATH.

3. Webpack DevServer websocket errors in browser

These are development WebSocket errors (hot reload). They don’t break functionality. If persistent, try disabling extension or use a different browser.

4. React imports CSS error (e.g., .sidebar { appears in .jsx)

Make sure .css files are imported only in JS files and you did not accidentally paste CSS into a .jsx component file. CSS must be in .css files (e.g., Sidebar.css) not inside Sidebar.jsx. Example:

// Sidebar.jsx
import "./Sidebar.css";

5. Duplicate /conversations calls

Likely caused by:

Both App and Sidebar calling the same endpoint on mount.

Two useEffect hooks without proper dependency arrays firing.
Fix: call /conversations only once (e.g., in Sidebar), or lift state up and pass conversations as props.

6. Clear history not immediately reflected in sidebar

Ensure /history/clear actually deletes DB rows and that frontend refreshes the conversation list after clearing (call /conversations again and update local state).

Useful commands & development tips

Run backend with reload for dev:

uvicorn main:app --reload


Use Postman or cURL to test endpoints:

curl -X POST "http://127.0.0.1:8000/chat" -H "Content-Type: application/json" -d '{"message":"Hello"}'


Inspect DB (sqlite):

sqlite3 chat_history.db
sqlite> .tables
sqlite> SELECT * FROM chat_messages LIMIT 10;

Production & deployment

For production, build React front-end:

cd frontend
npm run build


Serve the built static files via a static web server (NGINX) or mount them in FastAPI with StaticFiles.

Run backend with a production ASGI server (Uvicorn/Gunicorn) behind a reverse proxy.

Protect your GROQ_API_KEY — store it in hosted environment variables, never commit .env.


<img width="539" height="402" alt="image" src="https://github.com/user-attachments/assets/9f68e40e-4ce8-430d-aec3-0477d68d2964" />


Example requirements.txt (backend)
fastapi
uvicorn[standard]
python-dotenv
sqlalchemy
pydantic
groq
requests

Example .env (backend)
GROQ_API_KEY=sk-xxxxxxxx
DATABASE_URL=sqlite:///./chat_history.db

Final tips (for your demo)
