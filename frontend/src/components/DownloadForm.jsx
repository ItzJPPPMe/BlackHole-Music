import React, { useState } from 'react';
import { isValidUrl } from '../utils/helpers';

export default function DownloadForm({ onStartDownload, onPlaylistDownload, onStreamDownload, loading }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('video');
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('best');
  const [albumStructure, setAlbumStructure] = useState(false);

  const musicFormats = ['mp3', 'flac', 'wav', 'aac', 'ogg'];
  const videoFormats = ['mp4', 'webm'];

  const placeholders = {
    video: 'Video URL\'sini yapıştırın...',
    music: 'Müzik URL\'sini yapıştırın...',
    playlist: 'Playlist URL\'sini yapıştırın...',
    stream: 'YouTube/Twitch/Kick yayın tekrarı URL\'si...',
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Lütfen bir URL girin.');
      return;
    }

    if (!isValidUrl(url)) {
      setError('Geçersiz URL. http veya https ile başlayan bir URL girin.');
      return;
    }

    if (mode === 'playlist') {
      onPlaylistDownload(url, quality, format, null, albumStructure);
    } else if (mode === 'stream') {
      onStreamDownload(url, quality, format, null);
    } else {
      onStartDownload(url, quality, format, null, mode, albumStructure);
    }
    setUrl('');
  };

  const showQuality = mode === 'video' || mode === 'stream';
  const showAlbumOption = mode === 'music' || mode === 'playlist';

  return (
    <form className="download-form" onSubmit={handleSubmit}>
      <div className="mode-selector">
        <button type="button" className={`mode-btn ${mode === 'video' ? 'active' : ''}`}
          onClick={() => { setMode('video'); setFormat('mp4'); }}>
          Video
        </button>
        <button type="button" className={`mode-btn ${mode === 'music' ? 'active' : ''}`}
          onClick={() => { setMode('music'); setFormat('mp3'); }}>
          Müzik
        </button>
        <button type="button" className={`mode-btn ${mode === 'playlist' ? 'active' : ''}`}
          onClick={() => { setMode('playlist'); setFormat('mp3'); }}>
          Playlist
        </button>
        <button type="button" className={`mode-btn ${mode === 'stream' ? 'active' : ''}`}
          onClick={() => { setMode('stream'); setFormat('mp4'); }}>
          Yayın Tekrarı
        </button>
      </div>

      <input
        type="text"
        placeholder={placeholders[mode]}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={loading}
      />

      <div className="options-row">
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          {(mode === 'video' || mode === 'stream' ? videoFormats : musicFormats).map(f => (
            <option key={f} value={f}>{f.toUpperCase()}</option>
          ))}
        </select>

        {showQuality && (
          <select value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="best">En İyi</option>
            <option value="1080">1080p</option>
            <option value="720">720p</option>
            <option value="480">480p</option>
          </select>
        )}

        {showAlbumOption && (
          <label className="checkbox-label">
            <input type="checkbox" checked={albumStructure}
              onChange={(e) => setAlbumStructure(e.target.checked)} />
            Albüm klasör yapısı
          </label>
        )}

        {mode === 'stream' && (
          <span className="platform-hint">YouTube, Twitch, Kick desteklenir</span>
        )}
      </div>

      <button type="submit" disabled={loading || !url.trim()}>
        {loading ? 'İşleniyor...' :
         mode === 'playlist' ? 'Playlist İndir' :
         mode === 'stream' ? 'Yayın İndir' : 'İndir'}
      </button>

      {error && <span className="form-error">{error}</span>}
    </form>
  );
}
