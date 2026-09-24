import React from 'react';

const PLATFORM_LABELS = {
  youtube: { label: 'YouTube', className: 'youtube' },
  soundcloud: { label: 'SoundCloud', className: 'soundcloud' },
  spotify: { label: 'Spotify', className: 'spotify' },
};

export default function SearchResultCard({ item, onDownload, onSave, onAddToPlaylist }) {
  const platform = PLATFORM_LABELS[item.platform] || PLATFORM_LABELS.youtube;

  const formatDuration = (dur) => {
    if (!dur) return '';
    if (dur.includes(':')) return dur;
    return dur;
  };

  return (
    <div className="search-result-card">
      <div className="result-thumbnail">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div className="thumbnail-fallback" style={{ display: item.thumbnail ? 'none' : 'flex' }}>
          ♫
        </div>
        {item.duration && (
          <span className="duration-badge">{formatDuration(item.duration)}</span>
        )}
      </div>

      <div className="result-info">
        <h4 className="result-title">{item.title}</h4>
        {item.uploader && <p className="result-uploader">{item.uploader}</p>}
        <div className="result-platform">
          <span className={`platform-dot ${platform.className}`}></span>
          {platform.label}
        </div>
      </div>

      <div className="result-actions">
        <button
          className="result-btn music-btn"
          onClick={() => onDownload(item.url, 'music', 'mp3')}
          title="Müzik olarak indir (MP3)"
        >
          ♫
        </button>
        <button
          className="result-btn video-btn"
          onClick={() => onDownload(item.url, 'video', 'mp4')}
          title={`Video olarak indir (MP4)${item.platform !== 'youtube' ? ' - yt-dlp ile' : ''}`}
        >
          ▶
        </button>
        <button
          className="result-btn save-btn"
          onClick={() => onSave(item)}
          title="Müziklerim listesine kaydet"
        >
          +
        </button>
        {onAddToPlaylist && (
          <button
            className="result-btn pl-btn"
            onClick={() => onAddToPlaylist(item)}
            title="Listelerime ekle"
          >
            + Liste
          </button>
        )}
      </div>
    </div>
  );
}