import React from 'react';

export default function DownloadList({ downloads = [] }) {
  if (!downloads.length) {
    return (
      <div className="download-list-empty">
        <p>Aktif indirme bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="download-list">
      {downloads.map((item) => (
        <div key={item.id} className="download-item">
          <div className="download-info">
            <span className="download-title">{item.title || item.url}</span>
            <span className="download-status">{item.status}</span>
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${item.progress || 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}