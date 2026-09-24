import React from 'react';

export default function PlaylistPreview({ playlist, onDownload, loading }) {
  if (!playlist) return null;

  return (
    <div className="playlist-preview">
      <div className="playlist-header">
        <h3>{playlist.title}</h3>
        <span className="track-count">{playlist.track_count} şarkı</span>
      </div>
      <div className="playlist-tracks">
        {playlist.tracks.map((track) => (
          <div key={track.index} className="playlist-track">
            <span className="track-index">{track.index}</span>
            <div className="track-info">
              <span className="track-title">{track.title}</span>
              <span className="track-uploader">{track.uploader}</span>
            </div>
            <span className="track-duration">{track.duration}</span>
          </div>
        ))}
      </div>
      <button
        className="primary-btn playlist-download-btn"
        onClick={() => onDownload(playlist.url)}
        disabled={loading}
      >
        {loading ? 'İndiriliyor...' : 'Tümünü İndir'}
      </button>
    </div>
  );
}
