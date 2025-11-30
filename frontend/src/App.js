// src/App.js
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./App.css";
import Sidebar from "./components/Sidebar"; // presentational sidebar (no fetch inside)

const API_BASE = "http://127.0.0.1:8000";
const LOCAL_HISTORY_KEY = "chat_history";
const LOCAL_CONV_KEY = "conv_id";

function App() {
  const [messages, setMessages] = useState([]); // chat bubbles shown in main area
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [conversations, setConversations] = useState([]); // sidebar list
  const [activeConv, setActiveConv] = useState(localStorage.getItem(LOCAL_CONV_KEY) || null);

  const bottomRef = useRef(null);
  const didFetchConversations = useRef(false); // guard for double-mount in StrictMode

  // helper: fetch server-side history for a conv id and set messages
  const fetchHistory = async (convId) => {
    if (!convId) return null;
    try {
      const res = await axios.get(`${API_BASE}/history`, {
        params: { conversation_id: convId, limit: 500 },
      });
      if (Array.isArray(res.data)) {
        const msgs = res.data.map((m) => ({
          role: m.role === "user" ? "user" : "bot",
          text: m.content,
        }));
        setMessages(msgs);
        return msgs;
      }
    } catch (err) {
      console.warn("fetchHistory error:", err?.message || err);
    }
    return null;
  };

  // reload conversation summaries for sidebar
  const reloadConversations = async () => {
    try {
      const res = await axios.get(`${API_BASE}/conversations`, { params: { limit: 50 } });
      if (res?.data) setConversations(res.data);
    } catch (err) {
      console.warn("reloadConversations error:", err?.message || err);
    }
  };

  // on mount: try to load from server (if conv id exists) else fallback to localStorage
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // fetch conversations once (guard duplicates from StrictMode)
      if (!didFetchConversations.current) {
        didFetchConversations.current = true;
        await reloadConversations();
      }

      const convId = localStorage.getItem(LOCAL_CONV_KEY);
      if (convId && !cancelled) {
        await fetchHistory(convId);
        setActiveConv(convId);
        setLoading(false);
        return;
      }

      // fallback: localStorage chat_history
      try {
        const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
        if (raw && !cancelled) setMessages(JSON.parse(raw));
      } catch (e) {
        console.warn("load fallback error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // persist local copy and auto-scroll on messages change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(messages));
    } catch {}
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // send message
  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // optimistic append user message
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const convId = localStorage.getItem(LOCAL_CONV_KEY) || null;
      const payload = { message: text };
      if (convId) payload.conversation_id = convId;

      const res = await axios.post(`${API_BASE}/chat`, payload);
      const botReply = res?.data?.reply ?? "No reply";
      const returnedConv = res?.data?.conversation_id ?? null;

      if (returnedConv) {
        // save conv id and fetch DB truth (replace optimistic UI)
        localStorage.setItem(LOCAL_CONV_KEY, returnedConv);
        setActiveConv(returnedConv);
        // reload list and then fetch history from DB to sync UI
        await reloadConversations();
        await fetchHistory(returnedConv);
      } else {
        // fallback: append bot reply (no conv id returned)
        setMessages((m) => [...m, { role: "bot", text: botReply }]);
        // reload conversations in case backend changed
        await reloadConversations();
      }
    } catch (err) {
      console.error("API error:", err);
      const detail = err?.response?.data?.detail || err.message || "Request failed";
      setMessages((m) => [...m, { role: "bot", text: "Error: " + detail }]);
      // still try to reload conversations to keep sidebar consistent
      await reloadConversations();
    } finally {
      setLoading(false);
    }
  };

  // Enter to send (Shift+Enter for newline)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Open conversation from sidebar
  const openConversation = async (convId) => {
    if (!convId) return;
    try {
      localStorage.setItem(LOCAL_CONV_KEY, convId);
      setActiveConv(convId);
      setLoading(true);
      await fetchHistory(convId);
      setLoading(false);
    } catch (err) {
      console.warn("openConversation error:", err);
      setLoading(false);
    }
  };

  // Clear current conversation (server + UI)
  const clearChat = async () => {
    const convId = localStorage.getItem(LOCAL_CONV_KEY);
    try {
      // ask backend to clear and (backend returns updated conversation list)
      const res = await axios.post(`${API_BASE}/history/clear`, null, { params: { conversation_id: convId } });
      // clear client state
      setMessages([]);
      localStorage.removeItem(LOCAL_HISTORY_KEY);
      localStorage.removeItem(LOCAL_CONV_KEY);
      setActiveConv(null);

      // backend may return conversations array — use it to update sidebar immediately
      if (res?.data?.conversations) {
        setConversations(res.data.conversations);
      } else {
        await reloadConversations();
      }
    } catch (err) {
      console.error("clear failed", err);
      // best-effort local clear anyway
      setMessages([]);
      localStorage.removeItem(LOCAL_HISTORY_KEY);
      localStorage.removeItem(LOCAL_CONV_KEY);
      setActiveConv(null);
      await reloadConversations();
    }
  };

  return (
    <div className="app-shell" style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar receives conversations and open handler */}
      <Sidebar
        conversations={conversations}
        onOpenConversation={openConversation}
        activeConv={activeConv}
        onReload={reloadConversations}
      />

      {/* main chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header className="chat-header">
          <div className="title">AI Chatbot</div>
          <div className="actions">
            <button className="muted" onClick={clearChat} disabled={loading}>Clear</button>
          </div>
        </header>

        <main
          className="chat-body"
          role="log"
          aria-live="polite"
          style={{ flex: 1, overflow: "auto", padding: "18px" }}
        >
          {messages.length === 0 && (
            <div className="empty">{loading ? "Loading conversation…" : "Say hi — start the conversation"}</div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role === "user" ? "user" : "bot"}`}>
              {m.text}
            </div>
          ))}

          {loading && messages.length > 0 && <div className="bubble bot">Typing…</div>}
          <div ref={bottomRef} />
        </main>

        <footer className="chat-input">
          <textarea
            placeholder="Type your message (Enter to send, Shift+Enter for newline)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <div className="send-col">
            <button onClick={send} disabled={loading || !input.trim()}>
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
