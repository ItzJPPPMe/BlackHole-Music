import React from 'react';

export default function History({ historyItems = [] }) {
  if (!historyItems.length) {
    return (
      <div className="history-empty">
        <p>Henüz indirme geçmişi yok.</p>
      </div>
    );
  }

  return (
    <div className="history-container">
      <h3>İndirme Geçmişi</h3>
      <ul className="history-list">
        {historyItems.map((item) => (
          <li key={item.id} className="history-item">
            <span className="history-title">{item.title || item.url}</span>
            <span className={`history-status ${item.status}`}>
              {item.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}