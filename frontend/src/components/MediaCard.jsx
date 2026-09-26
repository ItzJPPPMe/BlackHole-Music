import React from 'react';

export default function MediaCard({ item, onDelete, onPlay, onAddToPlaylist, onOpenFolder }) {
  const formatDuration = (sec) => {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="media-card">
      <div className="media-thumbnail">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} loading="lazy" />
        ) : (
          <div className="thumbnail-placeholder">
            {item.type === 'music' ? '♫' : '▶'}
          </div>
        )}
        {item.duration && (
          <span className="duration-badge">{formatDuration(item.duration)}</span>
        )}
        <div className="media-type-badge">{item.type === 'music' ? 'MP3' : 'MP4'}</div>
        {item.status === 'downloading' && (
          <div className="status-overlay downloading">
            <span className="spinner"></span>
            {item.progress != null ? `İndiriliyor... %${Math.round(item.progress)}` : 'İndiriliyor...'}
          </div>
        )}
        {item.status === 'error' && (
          <div className="status-overlay error"><span>✕</span>Hata</div>
        )}
      </div>

      <div className="media-info">
        <h3 className="media-title">{item.title}</h3>
        {item.artist && <p className="media-artist">{item.artist}</p>}
        {item.status === 'completed' && <p className="media-done">✓ İndirildi{item.size ? ' · ' + formatSize(item.size) : ''}</p>}
      </div>

      <div className="media-actions">
        <button
          className="action-btn play-action"
          title="Oynat"
          onClick={() => onPlay && onPlay(item)}
        >
          ▶
        </button>
        {item.status === 'completed' && item.path && onOpenFolder && (
          <button
            className="action-btn folder-action"
            title="Klasörde göster"
            onClick={() => onOpenFolder && onOpenFolder(item)}
          >
            ⇓
          </button>
        )}
        {onAddToPlaylist && (
          <button
            className="action-btn add-action"
            onClick={() => onAddToPlaylist(item)}
            title="Listeye ekle"
          >
            +
          </button>
        )}
      </div>

      <button className="delete-btn" onClick={() => onDelete(item.id)} title="Sil">
        ×
      </button>
    </div>
  );
}
