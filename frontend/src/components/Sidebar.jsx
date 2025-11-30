// src/components/Sidebar.jsx
import React from "react";
import "./Sidebar.css";
 // optional: pretty date (install date-fns or remove usage)

function Sidebar({
  conversations = [],
  onOpenConversation = () => {},
  activeConv = null,
  onReload = () => {},
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h3 className="sidebar-title">Your chats</h3>

        <div className="sidebar-actions">
          <button
            className="icon-btn reload"
            title="Reload conversations"
            onClick={() => onReload && onReload()}
          >
            ⟳
          </button>

          <button
            className="new-btn"
            onClick={() => {
              // open a fresh conversation (no conv id)
              onOpenConversation && onOpenConversation(null);
            }}
            title="New conversation"
          >
            + New
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <input placeholder="Search chats..." aria-label="Search chats" />
      </div>

      <div className="conversations-list" role="list">
        {conversations.length === 0 && (
          <div className="empty-list">No conversations yet</div>
        )}

        {conversations.map((c) => {
          const id = c.conversation_id ?? c.conversationId ?? c.id;
          const title =
            (c.last_message && c.last_message.slice(0, 60)) ||
            `Conversation ${id?.slice?.(0, 8) || ""}`;
          const msgCount = c.count ?? c.message_count ?? 0;
          const time = c.last_time
            ? (() => {
                try {
                  return new Date(c.last_time), "dd/MM/yyyy, p";
                } catch {
                  return c.last_time;
                }
              })()
            : "";

          const isActive = activeConv && id === activeConv;

          return (
            <div
              key={id}
              role="listitem"
              className={`conv-item ${isActive ? "active" : ""}`}
              onClick={() => onOpenConversation(id)}
            >
              <div className="conv-left">
                <div className="conv-title">{title}</div>
                <div className="conv-meta">
                  <span className="conv-count">{msgCount} msgs</span>
                  <span className="conv-time">{time}</span>
                </div>
              </div>

              <div className="conv-right">
                <button
                  className="icon-play"
                  title="Open conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenConversation(id);
                  }}
                >
                  ▶
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className="local-note">Local history · {conversations.length} items</div>
      </div>
    </aside>
  );
}

export default Sidebar;
