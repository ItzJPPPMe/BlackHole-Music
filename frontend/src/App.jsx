import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MediaCard from './components/MediaCard';
import SearchBar from './components/SearchBar';
import SearchResultCard from './components/SearchResultCard';
import { requestDownload, searchMusic, getPlaylistInfo, getDiskFiles, deleteDiskFile } from './services/api';
import './App.css';

const STORAGE_KEY = 'ender_downloader_media';
const PLAYLISTS_KEY = 'blackhole_music_playlists';

function loadMedia() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveMedia(media) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(media));
}

function loadPlaylists() {
  try {
    const data = localStorage.getItem(PLAYLISTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function savePlaylists(playlists) {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}

function thumbnailFromUrl(url) {
  const match = url.match(/(?:v=|\/)([\w-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : '';
}

export default function App() {
  const [media, setMedia] = useState(loadMedia);
  const [diskFiles, setDiskFiles] = useState([]);
  const [playlists, setPlaylists] = useState(loadPlaylists);
  const [activeTab, setActiveTab] = useState('myt');
  const [searchQuery, setSearchQuery] = useState('');
  const [mytQuery, setMytQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistMode, setPlaylistMode] = useState('create');
  const [playlistName, setPlaylistName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);

  useEffect(() => {
    saveMedia(media);
  }, [media]);

  useEffect(() => {
    savePlaylists(playlists);
  }, [playlists]);

  useEffect(() => {
    let cancelled = false;
    getDiskFiles()
      .then(res => { if (!cancelled) setDiskFiles(res.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const tabs = [
    { id: 'videos', label: 'VİDEOLARIM' },
    { id: 'myt', label: 'ARAMA' },
    { id: 'music', label: 'MÜZİKLERİM' },
    { id: 'playlists', label: 'LİSTELERİM' },
  ];

  const handleMytSearch = useCallback(async (queryOverride) => {
    const q = (queryOverride !== undefined ? queryOverride : mytQuery).trim();
    if (!q) return;
    setSearching(true);
    setStatus({ type: 'info', message: 'Aranıyor...' });
    try {
      const res = await searchMusic(q, 15);
      setSearchResults(res.data || []);
      setStatus(null);
    } catch (err) {
      setStatus({ type: 'error', message: 'Arama hatası: ' + err.message });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [mytQuery]);

  useEffect(() => {
    if (!mytQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => handleMytSearch(mytQuery), 500);
    return () => clearTimeout(timer);
  }, [mytQuery]);

  const handleMytKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleMytSearch();
    }
  };

  const filteredMedia = media.filter(item => {
    const matchesSearch = !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.artist && item.artist.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeTab === 'videos') return matchesSearch && item.type === 'video';
    if (activeTab === 'music') return matchesSearch && item.type === 'music';
    return matchesSearch;
  });

  const allMedia = useMemo(() => {
    const existingTitles = new Set(media.map(m => (m.title || '').trim()));
    const diskItems = (diskFiles || [])
      .filter(f => !existingTitles.has((f.name || '').trim()))
      .map(f => ({
        id: 'disk-' + f.path,
        url: '',
        title: f.name,
        artist: '',
        type: f.file_type === 'music' ? 'music' : 'video',
        format: f.name.split('.').pop().toLowerCase(),
        thumbnail: '',
        date: f.modified_at,
        status: 'completed',
        disk: true,
        path: f.path,
        size: f.size,
      }));
    return diskItems.concat(media);
  }, [media, diskFiles]);

  const displayMedia = allMedia.filter(item => {
    const matchesSearch = !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.artist && item.artist.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeTab === 'videos') return matchesSearch && item.type === 'video';
    if (activeTab === 'music') return matchesSearch && item.type === 'music';
    return matchesSearch;
  });

  const handleDownload = async (url, type, format) => {
    if (!url) {
      setStatus({ type: 'error', message: 'URL yok' });
      return;
    }
    const id = Date.now();
    const newItem = {
      id,
      url,
      title: url.split('/').pop() || 'Bilinmeyen',
      artist: '',
      type,
      format: format || (type === 'music' ? 'mp3' : 'mp4'),
      thumbnail: thumbnailFromUrl(url),
      date: new Date().toISOString(),
      status: 'downloading',
    };
    setMedia(prev => [newItem, ...prev]);
    setLoading(true);
    setStatus({ type: 'info', message: `${type === 'music' ? 'Müzik' : 'Video'} indiriliyor...` });

    try {
      const res = await requestDownload(url, 'best', format || (type === 'music' ? 'mp3' : 'mp4'), null, type);
      setMedia(prev => prev.map(item => item.id === id
        ? {
          ...item,
          status: 'completed',
          title: res.data?.title || item.title,
          artist: res.data?.title?.split(' - ')[0] || item.artist,
          format: res.data?.title?.split('.').pop()?.toLowerCase() || item.format,
        }
        : item
      ));
      setStatus({ type: 'success', message: `${type === 'music' ? 'Müzik' : 'Video'} indirildi!` });
    } catch (err) {
      setMedia(prev => prev.map(item => item.id === id ? { ...item, status: 'error' } : item));
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedia = (id) => {
    if (typeof id === 'string' && id.startsWith('disk-')) {
      const diskItem = diskFiles.find(f => 'disk-' + f.path === id);
      if (!diskItem) return;
      deleteDiskFile(diskItem.path)
        .then(() => {
          setDiskFiles(prev => prev.filter(f => f.path !== diskItem.path));
          setStatus({ type: 'success', message: 'Dosya silindi' });
        })
        .catch(err => setStatus({ type: 'error', message: 'Dosya silinemedi: ' + err.message }));
      return;
    }

    const record = media.find(m => m.id === id);
    setMedia(prev => prev.filter(item => item.id !== id));

    if (record && record.title) {
      const diskItem = diskFiles.find(f => (f.name || '').trim() === (record.title || '').trim());
      if (diskItem) {
        deleteDiskFile(diskItem.path)
          .then(() => setDiskFiles(prev => prev.filter(f => f.path !== diskItem.path)))
          .catch(() => {});
      }
    }
  };

  const handleAddManual = (title, url, type) => {
    const newItem = {
      id: Date.now(),
      url: url || '',
      title: title || 'Bilinmeyen',
      artist: '',
      type,
      format: type === 'music' ? 'mp3' : 'mp4',
      thumbnail: url ? thumbnailFromUrl(url) : '',
      date: new Date().toISOString(),
      status: 'manual',
    };
    setMedia(prev => [newItem, ...prev]);
    setShowAddModal(false);
    setStatus({ type: 'success', message: 'Eklendi!' });
  };

  const openPlaylistModal = (mode) => {
    setPlaylistMode(mode);
    setShowPlaylistModal(true);
  };

  const createPlaylist = () => {
    const name = playlistName.trim();
    if (!name) {
      setStatus({ type: 'error', message: 'Liste adı gerekli' });
      return;
    }
    const playlist = {
      id: Date.now(),
      name,
      url: '',
      source: 'custom',
      createdAt: new Date().toISOString(),
      tracks: [],
    };
    setPlaylists(prev => [playlist, ...prev]);
    setPlaylistName('');
    setShowPlaylistModal(false);
    setActivePlaylistId(playlist.id);
    setStatus({ type: 'success', message: 'Liste oluşturuldu' });
  };

  const loadYoutubePlaylist = async () => {
    const url = playlistUrl.trim();
    if (!url) {
      setStatus({ type: 'error', message: 'Playlist URL gerekli' });
      return;
    }
    setPlaylistBusy(true);
    try {
      const res = await getPlaylistInfo(url);
      const data = res.data || { title: 'YouTube Playlist', tracks: [] };
      const tracks = (data.tracks || []).map((track, i) => ({
        id: Date.now() + i,
        title: track.title || `Parça ${i + 1}`,
        artist: track.uploader || '',
        url: track.url || '',
        thumbnail: track.url ? thumbnailFromUrl(track.url) : '',
        duration: track.duration || '',
        source: 'youtube',
      }));
      const playlist = {
        id: Date.now(),
        name: data.title || 'YouTube Playlist',
        url,
        source: 'youtube',
        createdAt: new Date().toISOString(),
        tracks,
      };
      setPlaylists(prev => [playlist, ...prev]);
      setPlaylistUrl('');
      setShowPlaylistModal(false);
      setActivePlaylistId(playlist.id);
      setStatus({ type: 'success', message: `Playlist yüklendi (${tracks.length} parça)` });
    } catch (err) {
      setStatus({ type: 'error', message: 'Playlist yüklenemedi: ' + err.message });
    } finally {
      setPlaylistBusy(false);
    }
  };

  const addTrackToPlaylist = (playlistId, item) => {
    const track = {
      id: Date.now(),
      title: item.title || 'Bilinmeyen',
      artist: item.artist || item.uploader || '',
      url: item.url || '',
      thumbnail: item.thumbnail || (item.url ? thumbnailFromUrl(item.url) : ''),
      duration: item.duration || '',
    };
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, tracks: [track, ...p.tracks] } : p));
    setPickerTarget(null);
    setStatus({ type: 'success', message: 'Listeye eklendi' });
  };

  const removeTrackFromPlaylist = (playlistId, trackId) => {
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p));
  };

  const deletePlaylist = (id) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (activePlaylistId === id) setActivePlaylistId(null);
    setStatus({ type: 'success', message: 'Liste silindi' });
  };

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);

  const renderPlaylistSection = () => {
    if (playlists.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">♫</div>
          <p>Henüz liste yok. Kendi listeni oluştur veya YouTube'dan bir playlist yükle.</p>
          <div className="empty-actions">
            <button className="add-btn" onClick={() => openPlaylistModal('create')}>+ Liste Oluştur</button>
            <button className="add-btn secondary" onClick={() => openPlaylistModal('load')}>YouTube Playlist Yükle</button>
          </div>
        </div>
      );
    }

    if (activePlaylist) {
      return (
        <div className="playlist-detail">
          <div className="detail-header">
            <button className="back-btn" onClick={() => setActivePlaylistId(null)}>‹ Geri</button>
            <div className="detail-title">
              <h3>{activePlaylist.name}</h3>
              <span className={`pl-badge ${activePlaylist.source}`}>
                {activePlaylist.source === 'youtube' ? 'YouTube' : 'Özel Liste'}
              </span>
            </div>
            <span className="detail-count">{activePlaylist.tracks.length} parça</span>
          </div>

          {activePlaylist.tracks.length === 0 ? (
            <div className="pl-empty-tracks">
              <p>Listede henüz parça yok. Arama sonuçlarındaki "+" ile istediğin şarkıyı veya videoyu buraya ekleyebilirsin.</p>
              <button className="add-btn" onClick={() => setActiveTab('myt')}>Aramaya Git</button>
            </div>
          ) : (
            <div className="media-grid">
              {activePlaylist.tracks.map(track => (
                <div className="media-card" key={track.id}>
                  <div className="media-thumbnail">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt={track.title} loading="lazy" />
                    ) : (
                      <div className="thumbnail-placeholder">♫</div>
                    )}
                  </div>
                  <div className="media-info">
                    <h3 className="media-title">{track.title}</h3>
                    <p className="media-artist">{track.artist || '\u00A0'}</p>
                  </div>
                  <div className="media-actions">
                    <button
                      className="action-btn music-action"
                      onClick={() => handleDownload(track.url, 'music', 'mp3')}
                      title="Müzik olarak indir"
                    >♫</button>
                    <button
                      className="action-btn video-action"
                      onClick={() => handleDownload(track.url, 'video', 'mp4')}
                      title="Video olarak indir"
                    >▶</button>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => removeTrackFromPlaylist(activePlaylist.id, track.id)}
                    title="Listeden çıkar"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="playlist-section">
        <div className="playlist-toolbar">
          <h3 className="section-title">Listelerim</h3>
          <div className="playlist-actions">
            <button className="add-btn" onClick={() => openPlaylistModal('create')}>+ Liste Oluştur</button>
            <button className="add-btn secondary" onClick={() => openPlaylistModal('load')}>YouTube Playlist Yükle</button>
          </div>
        </div>
        <div className="playlist-grid">
          {playlists.map(p => (
            <div className="playlist-card" key={p.id} onClick={() => setActivePlaylistId(p.id)}>
              <div className="pl-card-icon">{p.source === 'youtube' ? '▶' : '♫'}</div>
              <div className="pl-card-info">
                <h4>{p.name}</h4>
                <span>{p.tracks.length} parça</span>
              </div>
              <button
                className="pl-delete"
                onClick={(e) => { e.stopPropagation(); deletePlaylist(p.id); }}
                title="Listeyi sil"
              >×</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMediaSection = () => {
    if (displayMedia.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">♫</div>
          <p>Henüz {activeTab === 'videos' ? 'video' : 'müzik'} eklenmedi</p>
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            + İlk İçeriği Ekle
          </button>
        </div>
      );
    }

    return (
      <div className="media-grid">
        {displayMedia.map(item => (
          <MediaCard
            key={item.id}
            item={item}
            onDelete={handleDeleteMedia}
            onAddToPlaylist={(track) => setPickerTarget(track)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-logo">BlackHole Music</h1>
        </div>
        <div className="header-right">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
      </header>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {status && (
        <div className={`status-toast ${status.type}`}>
          {status.message}
        </div>
      )}

      <main className="content">
        {activeTab === 'myt' ? (
          <div className="myt-search-section">
            <div className="myt-search-bar">
              <input
                type="text"
                placeholder="Şarkı, sanatçı veya URL ara..."
                value={mytQuery}
                onChange={(e) => setMytQuery(e.target.value)}
                onKeyDown={handleMytKeyDown}
                className="myt-search-input"
              />
              <button
                className="myt-search-btn"
                onClick={handleMytSearch}
                disabled={searching}
              >
                {searching ? '⏳' : '🔍'}
              </button>
            </div>

            <div className="myt-platforms">
              <span className="platform-badge youtube">YouTube</span>
              <span className="platform-badge spotify">Spotify</span>
              <span className="platform-badge soundcloud">SoundCloud</span>
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                <h3 className="results-title">Arama Sonuçları ({searchResults.length})</h3>
                {searchResults.map((item) => (
                  <SearchResultCard
                    key={item.id}
                    item={item}
                    onDownload={handleDownload}
                    onSave={(item) => {
                      const newItem = {
                        id: Date.now(),
                        url: item.url,
                        title: item.title,
                        artist: item.uploader || '',
                        type: 'music',
                        format: 'mp3',
                        thumbnail: item.thumbnail,
                        date: new Date().toISOString(),
                        status: 'completed',
                      };
                      setMedia(prev => [newItem, ...prev]);
                      setStatus({ type: 'success', message: 'Müziklerim listesine eklendi!' });
                    }}
                    onAddToPlaylist={(track) => setPickerTarget(track)}
                  />
                ))}
              </div>
            )}

            {!searching && searchResults.length === 0 && mytQuery && (
              <div className="empty-search">
                <p>Sonuç bulunamadı</p>
              </div>
            )}

            {!mytQuery && searchResults.length === 0 && (
              <div className="myt-welcome">
                <div className="welcome-icon">♫</div>
                <h2>BlackHole Music</h2>
                <p>YouTube, Spotify ve diğer platformlardan müzik ve video arayın</p>
                <div className="suggestion-chips">
                  <button onClick={() => { setMytQuery('popular songs 2024'); handleMytSearch(); }}>Popüler Şarkılar</button>
                  <button onClick={() => { setMytQuery('turkish music'); handleMytSearch(); }}>Türkçe Müzik</button>
                  <button onClick={() => { setMytQuery('lofi hip hop'); handleMytSearch(); }}>Lo-Fi Beats</button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'playlists' ? (
          renderPlaylistSection()
        ) : (
          renderMediaSection()
        )}
      </main>

      <button
        className="fab"
        onClick={() => activeTab === 'playlists' ? openPlaylistModal('create') : setShowAddModal(true)}
      >+</button>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>İçerik Ekle</h3>
            <input type="text" placeholder="Başlık" id="modal-title" className="modal-input" />
            <input type="text" placeholder="URL (opsiyonel)" id="modal-url" className="modal-input" />
            <div className="modal-buttons">
              <button className="modal-btn video-btn" onClick={() => {
                const title = document.getElementById('modal-title').value;
                const url = document.getElementById('modal-url').value;
                handleAddManual(title, url, 'video');
              }}>Video Ekle</button>
              <button className="modal-btn music-btn" onClick={() => {
                const title = document.getElementById('modal-title').value;
                const url = document.getElementById('modal-url').value;
                handleAddManual(title, url, 'music');
              }}>Müzik Ekle</button>
              <button className="modal-btn cancel-btn" onClick={() => setShowAddModal(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {showPlaylistModal && (
        <div className="modal-overlay" onClick={() => setShowPlaylistModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{playlistMode === 'create' ? 'Yeni Liste' : 'YouTube Playlist Yükle'}</h3>
            {playlistMode === 'create' ? (
              <input
                type="text"
                placeholder="Liste adı"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="modal-input"
                onKeyDown={(e) => { if (e.key === 'Enter') createPlaylist(); }}
              />
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Playlist URL'si (youtube.com/playlist?...)"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  className="modal-input"
                  disabled={playlistBusy}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadYoutubePlaylist(); }}
                />
                {playlistBusy && <p className="pl-loading">Playlist yükleniyor...</p>}
              </>
            )}
            <div className="modal-buttons">
              {playlistMode === 'create' ? (
                <button className="modal-btn save-btn" onClick={createPlaylist}>Oluştur</button>
              ) : (
                <button className="modal-btn save-btn" onClick={loadYoutubePlaylist} disabled={playlistBusy}>Yükle</button>
              )}
              <button className="modal-btn cancel-btn" onClick={() => setShowPlaylistModal(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {pickerTarget && (
        <div className="modal-overlay" onClick={() => setPickerTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Listeye ekle</h3>
            {playlists.length === 0 ? (
              <p className="pl-empty-tracks">Henüz liste yok. Önce listeni oluştur veya bir YouTube playlisti yükle.</p>
            ) : (
              <div className="picker-list">
                {playlists.map(p => (
                  <button key={p.id} className="picker-item" onClick={() => addTrackToPlaylist(p.id, pickerTarget)}>
                    <span className="picker-icon">{p.source === 'youtube' ? '▶' : '♫'}</span>
                    <span className="picker-name">{p.name}</span>
                    <span className="picker-count">{p.tracks.length}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="modal-buttons">
              <button className="modal-btn cancel-btn" onClick={() => setPickerTarget(null)}>İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}