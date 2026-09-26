import React from 'react';

export default function MediaCard({ item, onDelete, onPlay, onAddToPlaylist, onOpenFolder, onCancelDownload, onRename, onToggleFavorite, selectMode, selected, onToggleSelect }) {
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

  const handlePlay = (e) => {
    if (selectMode) {
      if (onToggleSelect) onToggleSelect(item.id);
      return;
    }
    if (onPlay) onPlay(item);
  };

  return (
    <div className={`media-card${selectMode ? ' selectable' : ''}${selected ? ' selected' : ''}`}>
      {selectMode && (
        <div className="select-checkbox" onClick={(e) => { e.stopPropagation(); if (onToggleSelect) onToggleSelect(item.id); }}>
          {selected ? '✓' : ''}
        </div>
      )}
      <div className="media-thumbnail" onClick={handlePlay} style={{ cursor: 'pointer' }}>
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div className="thumbnail-placeholder" style={{ display: item.thumbnail ? 'none' : 'flex' }}>
          {item.type === 'music' ? '♫' : '▶'}
        </div>
        {item.duration && (
          <span className="duration-badge">{formatDuration(item.duration)}</span>
        )}
        <div className="media-type-badge">{item.type === 'music' ? 'MP3' : 'MP4'}</div>
        {item.status === 'downloading' && (
          <div className="status-overlay downloading">
            <span className="spinner"></span>
            {item.progress != null && item.progress >= 0
              ? `İndiriliyor... %${Math.round(item.progress)}`
              : 'Sırada...'}
            {item.speed && item.progress != null && item.progress > 0 && item.progress < 100 && (
              <span className="progress-stats">
                {item.speed}
                {item.eta ? ` · Kalan: ${item.eta}` : ''}
              </span>
            )}
          </div>
        )}
        {item.status === 'error' && (
          <div className="status-overlay error"><span>✕</span>Hata</div>
        )}
        {item.status === 'cancelled' && (
          <div className="status-overlay cancelled">İptal Edildi</div>
        )}
      </div>

      {item.status === 'downloading' && (
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.max(0, Math.min(100, item.progress || 0))}%` }}
          ></div>
        </div>
      )}

      <div className="media-info" onClick={handlePlay} style={{ cursor: 'pointer' }}>
        <h3 className="media-title">{item.title}</h3>
        {item.artist && <p className="media-artist">{item.artist}</p>}
        {item.status === 'completed' && <p className="media-done">✓ İndirildi{item.size ? ' · ' + formatSize(item.size) : ''}{item.favorite ? ' · ★' : ''}</p>}
      </div>

      <div className="media-actions">
        {onToggleFavorite && (
          <button
            className={`fav-btn${item.favorite ? ' favorited' : ''}`}
            onClick={() => onToggleFavorite(item.id)}
            title={item.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          >
            {item.favorite ? '★' : '☆'}
          </button>
        )}
        {item.status === 'downloading' ? (
          <button
            className="action-btn cancel-action"
            title="İndirmeyi iptal et"
            onClick={() => onCancelDownload && onCancelDownload(item)}
          >
            ⏹
          </button>
        ) : (
          <>
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
            {onRename && item.status === 'completed' && (
              <button
                className="action-btn rename-action"
                title="Dosyayı yeniden adlandır"
                onClick={() => onRename && onRename(item)}
              >
                ✎
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
          </>
        )}
      </div>

      <button className="delete-btn" onClick={() => onDelete(item.id)} title="Sil">
        ×
      </button>
    </div>
  );
}