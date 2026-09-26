import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MediaCard from './components/MediaCard';
import SearchBar from './components/SearchBar';
import SearchResultCard from './components/SearchResultCard';
import { requestDownload, searchMusic, getPlaylistInfo, getDiskFiles, deleteDiskFile, getAppSettings, updateAppSettings, getDownloadProgress, cancelDownload, renameDiskFile, getAppVersion, checkForUpdate, getVideoInfo, startBatchDownload, getStreamFileUrl, getLyrics } from './services/api';
import './App.css';

const STORAGE_KEY = 'ender_downloader_media';
const PLAYLISTS_KEY = 'blackhole_music_playlists';
const SETTINGS_KEY = 'blackhole_music_settings';
const THEME_KEY = 'blackhole_music_theme';

const THEMES = [
  { id: 'blue', label: 'Mavi', color: '#2196F3' },
  { id: 'purple', label: 'Mor', color: '#9C27B0' },
  { id: 'green', label: 'Yeşil', color: '#4CAF50' },
  { id: 'orange', label: 'Turuncu', color: '#FF9800' },
  { id: 'red', label: 'Kırmızı', color: '#f44336' },
];

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

function normalizeName(name) {
  return (name || '')
    .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .trim()
    .toLowerCase();
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistMode, setPlaylistMode] = useState('create');
  const [playlistName, setPlaylistName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlModalValue, setUrlModalValue] = useState('');
  const [urlModalQuality, setUrlModalQuality] = useState('best');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameItem, setRenameItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [sortMode, setSortMode] = useState('date');
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('blackhole_music_dark');
    return stored !== null ? stored === 'true' : true;
  });
  const [appSettings, setAppSettings] = useState(() => {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });
  const [settingsTheme, setSettingsTheme] = useState(() => {
    return localStorage.getItem(THEME_KEY) || 'blue';
  });

  const [appVersion, setAppVersion] = useState('1.3.0');
  const [updateInfo, setUpdateInfo] = useState(null);

  // Queue system
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [queueActive, setQueueActive] = useState(false);

  // Search history
  const [searchHistory, setSearchHistory] = useState(() => {
    try { const d = localStorage.getItem('search_history'); return d ? JSON.parse(d) : []; } catch { return []; }
  });

  // Recently played
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => {
    try { const d = localStorage.getItem('recently_played'); return d ? JSON.parse(d) : []; } catch { return []; }
  });

  // Player state
  const [player, setPlayer] = useState({ track: null, isPlaying: false, volume: 0.7, currentTime: 0, duration: 0, shuffle: false, repeat: 'none', playerItems: [], playerIndex: -1 });
  const audioRef = useRef(null);

  // Multi-select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  // Bulk URL modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkUrls, setBulkUrls] = useState('');

  // Version / info modal
  const [showVersionModal, setShowVersionModal] = useState(false);

  // Video preview
  const [videoPreview, setVideoPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Lyrics modal
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [currentLyrics, setCurrentLyrics] = useState({ title: '', artist: '', lyrics: '' });
  const [lyricsLoading, setLyricsLoading] = useState(false);

  // Keyboard shortcuts ref
  const appRef = useRef(null);

  useEffect(() => {
    if (!window.electronAPI?.onAction) return;
    window.electronAPI.onAction((action) => {
      if (action === 'show-history') setActiveTab('history');
      if (action === 'new-download') setActiveTab('myt');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAppVersion()
      .then(res => { if (!cancelled && res?.data?.version) setAppVersion(res.data.version); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkForUpdate()
      .then(res => { if (!cancelled && res?.data) setUpdateInfo(res.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    saveMedia(media);
  }, [media]);

  useEffect(() => {
    savePlaylists(playlists);
  }, [playlists]);

  useEffect(() => {
    document.body.setAttribute('data-theme', settingsTheme);
    document.body.setAttribute('data-layout', darkMode ? 'dark' : 'light');
    localStorage.setItem(THEME_KEY, settingsTheme);
  }, [settingsTheme]);

  useEffect(() => {
    document.body.setAttribute('data-layout', darkMode ? 'dark' : 'light');
    localStorage.setItem('blackhole_music_dark', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;
    getAppSettings()
      .then(res => {
        if (cancelled || !res?.data) return;
        setAppSettings(prev => {
          const merged = { ...(prev || {}), ...res.data };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
          return merged;
        });
        if (res.data.theme) {
          setSettingsTheme(res.data.theme);
        }
        if (res.data.dark_mode != null) {
          setDarkMode(!!res.data.dark_mode);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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

  useEffect(() => {
    localStorage.setItem('search_history', JSON.stringify(searchHistory.slice(0, 30)));
  }, [searchHistory]);

  useEffect(() => {
    localStorage.setItem('recently_played', JSON.stringify(recentlyPlayed.slice(0, 100)));
  }, [recentlyPlayed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F3' || (e.ctrlKey && e.key === 'f')) {
        e.preventDefault();
        document.querySelector('.myt-search-input')?.focus();
        return;
      }
      if (e.key === 'Escape') {
        setShowAddModal(false); setShowUrlModal(false); setShowSettingsModal(false);
        setShowRenameModal(false); setShowPlaylistModal(false); setShowBulkModal(false);
        setShowVersionModal(false); setPickerTarget(null);
        return;
      }
      if (e.key === ' ' && player.track && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        togglePlay();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); setActiveTab('myt'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); setActiveTab('history'); }
      if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); seekBy(10); }
      if (e.key === 'ArrowLeft' && e.altKey) { e.preventDefault(); seekBy(-10); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [player.track]);

  useEffect(() => {
    if (downloadQueue.length > 0 && !queueActive) {
      processQueue();
    }
  }, [downloadQueue, queueActive]);

  const togglePlay = () => {
    if (!player.track) return;
    if (player.isPlaying) {
      audioRef.current?.pause();
      setPlayer(p => ({ ...p, isPlaying: false }));
    } else {
      audioRef.current?.play().catch(() => {});
      setPlayer(p => ({ ...p, isPlaying: true }));
    }
  };

  const seekBy = (sec) => {
    if (!audioRef.current || !player.track) return;
    const newTime = Math.max(0, Math.min(player.duration, audioRef.current.currentTime + sec));
    audioRef.current.currentTime = newTime;
    setPlayer(p => ({ ...p, currentTime: newTime }));
  };

  const playTrack = (item, items, index) => {
    const itemsArr = items || [item];
    const idx = index !== undefined ? index : 0;
    setPlayer(p => ({ ...p, track: { ...item }, isPlaying: false, currentTime: 0, duration: 0, playerItems: itemsArr, playerIndex: idx }));
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(r => r.url !== item.url || r.title !== item.title);
      return [{ url: item.url || '', title: item.title, artist: item.artist, path: item.path, thumbnail: item.thumbnail, time: new Date().toISOString() }, ...filtered].slice(0, 100);
    });
  };

  const nextTrack = (direction = 1) => {
    const items = player.playerItems;
    if (items.length === 0) return;
    let nextIdx = player.playerIndex + direction;
    if (player.shuffle) {
      nextIdx = Math.floor(Math.random() * items.length);
    } else if (player.repeat === 'one') {
      nextIdx = player.playerIndex;
    } else if (nextIdx < 0 || nextIdx >= items.length) {
      if (player.repeat === 'all') {
        nextIdx = nextIdx < 0 ? items.length - 1 : 0;
      } else {
        setPlayer(p => ({ ...p, isPlaying: false }));
        return;
      }
    }
    playTrack(items[nextIdx], items, nextIdx);
  };

  // Queue processor
  const processQueue = useCallback(async () => {
    if (queueActive || downloadQueue.length === 0) return;
    setQueueActive(true);
    const item = downloadQueue[0];
    setDownloadQueue(prev => prev.map((q, i) => i === 0 ? { ...q, status: 'downloading' } : q));
    setStatus({ type: 'info', message: `Kuyruk: ${item.title} indiriliyor... (${downloadQueue.length} kaldı)` });
    await handleDownloadSingle(item.url, item.downloadType || 'video', item.format || 'mp4', item.quality || 'best');
    setDownloadQueue(prev => {
      const next = prev.slice(1);
      if (next.length === 0) {
        setQueueActive(false);
        return next;
      }
      return next;
    });
    setQueueActive(false);
  }, [downloadQueue, queueActive]);

  const addToQueue = (url, downloadType, format, quality) => {
    setDownloadQueue(prev => [...prev, { url, downloadType, format, quality, title: url.split('/').pop() || 'Bilinmeyen', status: 'queued' }]);
  };

  const tabs = [
    { id: 'videos', label: 'VİDEOLARIM' },
    { id: 'myt', label: 'ARAMA' },
    { id: 'music', label: 'MÜZİKLERİM' },
    { id: 'playlists', label: 'LİSTELERİM' },
    { id: 'history', label: 'GEÇMİŞ' },
    { id: 'favorites', label: 'FAVORİLER' },
  ];

  const skipAutoSearch = useRef(false);

  const handleMytSearch = useCallback(async (queryOverride) => {
    const q = (queryOverride !== undefined ? queryOverride : mytQuery).trim();
    if (!q) return;
    if (queryOverride !== undefined) {
      setMytQuery(q);
      skipAutoSearch.current = true;
    }
    setSearching(true);
    setStatus({ type: 'info', message: 'Aranıyor...' });
    try {
      const res = await searchMusic(q, 100);
      setSearchResults(res.data || []);
      setSearchHistory(prev => {
        const filtered = prev.filter(s => normalizeName(s) !== normalizeName(q));
        return [q, ...filtered].slice(0, 30);
      });
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
    if (skipAutoSearch.current) {
      skipAutoSearch.current = false;
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
    const existingTitles = new Set(media.map(m => normalizeName(m.title)));
    const diskItems = (diskFiles || [])
      .filter(f => !existingTitles.has(normalizeName(f.name)))
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
  }).sort((a, b) => {
    if (sortMode === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    if (sortMode === 'size') {
      return (b.size || 0) - (a.size || 0);
    }
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  const handleDownload = async (url, type, format, qualityOverride) => {
    if (!url) {
      setStatus({ type: 'error', message: 'URL yok' });
      return 'error';
    }
    // If already downloading, add to queue
    if (queueActive || downloadQueue.length > 0) {
      addToQueue(url, type, format, qualityOverride);
      setStatus({ type: 'info', message: 'Kuyruğa eklendi' });
      return 'queued';
    }
    return handleDownloadSingle(url, type, format, qualityOverride);
  };

  const handleDownloadSingle = async (url, type, format, qualityOverride) => {
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
      progress: 0,
      speed: '',
      eta: '',
    };
    setMedia(prev => [newItem, ...prev]);
    setStatus({ type: 'info', message: `${type === 'music' ? 'Müzik' : 'Video'} indiriliyor...` });

    const progressTimer = setInterval(async () => {
      try {
        const res = await getDownloadProgress();
        const pct = res?.data?.progress;
        if (pct != null) {
          setMedia(prev => prev.map(it => it.id === id ? {
            ...it,
            progress: Math.round(pct),
            speed: res?.data?.speed || '',
            eta: res?.data?.eta || '',
          } : it));
        }
      } catch { }
    }, 700);

    try {
      const targetFolder = appSettings?.[type === 'music' ? 'music_dir' : 'video_dir'] || null;
      const quality = type === 'video'
        ? (qualityOverride || appSettings?.video_quality || 'best')
        : 'best';
      const res = await requestDownload(url, quality, format || (type === 'music' ? 'mp3' : 'mp4'), targetFolder, type);
      clearInterval(progressTimer);
      setMedia(prev => prev.map(item => item.id === id
        ? {
          ...item,
          status: 'completed',
          progress: 100,
          title: res.data?.title || item.title,
          artist: res.data?.title?.split(' - ')[0] || item.artist,
          format: res.data?.title?.split('.').pop()?.toLowerCase() || item.format,
          path: res.data?.download_path || item.path || '',
          speed: '',
          eta: '',
        }
        : item
      ));
      setStatus({ type: 'success', message: `${type === 'music' ? 'Müzik' : 'Video'} indirildi!` });
      if (window.electronAPI?.notify) {
        window.electronAPI.notify('İndirme tamamlandı', `${type === 'music' ? 'Müzik' : 'Video'} indirildi: ${item.title}`);
      }
      if (window.electronAPI?.playSound) {
        window.electronAPI.playSound();
      }
      getDiskFiles()
        .then(res => setDiskFiles(res.data || []))
        .catch(() => {});
    } catch (err) {
      clearInterval(progressTimer);
      const cancelled = err.message.includes('cancel') || err.message.includes('iptal');
      setMedia(prev => prev.map(item => item.id === id
        ? { ...item, status: cancelled ? 'cancelled' : 'error', progress: cancelled ? 0 : 0, speed: '', eta: '' }
        : item));
      setStatus({ type: cancelled ? 'info' : 'error', message: cancelled ? 'İndirme iptal edildi' : err.message });
      return cancelled ? 'cancelled' : 'error';
    }
    return 'ok';
  };

  const handleCancelDownload = async (item) => {
    try {
      await cancelDownload();
      setMedia(prev => prev.map(it => {
        if (it.id !== item.id) return it;
        if (it.status === 'downloading') {
          return { ...it, status: 'cancelled', progress: 0, speed: '', eta: '' };
        }
        return { ...it, status: 'cancelled', progress: 0, speed: '', eta: '' };
      }));
      setStatus({ type: 'info', message: 'İndirme iptal edildi' });
    } catch (err) {
      setStatus({ type: 'error', message: 'İptal edilemedi: ' + err.message });
    }
  };

  const openRenameModal = (item) => {
    setRenameItem(item);
    let base = item?.path?.split(/[\\/]/).pop() || item?.title || '';
    setRenameValue(base);
    setShowRenameModal(true);
  };

  const submitRename = async () => {
    let newName = renameValue.trim();
    if (!renameItem || !newName) {
      setStatus({ type: 'error', message: 'Geçerli bir isim girin' });
      return;
    }
    const oldPath = renameItem.path || '';
    const oldExt = oldPath.includes('.') ? oldPath.split('.').pop().toLowerCase() : '';
    if (newName.endsWith('.' + oldExt)) {
      newName = newName;
    } else if (oldExt && !newName.includes('.')) {
      newName = newName + '.' + oldExt;
    }
    try {
      const res = await renameDiskFile(oldPath, newName);
      const newPath = res?.data?.path || '';
      const newNameOnly = res?.data?.name || newName;
      setDiskFiles(prev => prev.map(f => f.path === oldPath
        ? { ...f, path: newPath, name: newNameOnly }
        : f));
      setMedia(prev => prev.map(m => m.path === oldPath
        ? { ...m, path: newPath, title: newNameOnly, format: newNameOnly.split('.').pop().toLowerCase() }
        : m));
      setShowRenameModal(false);
      setRenameItem(null);
      setStatus({ type: 'success', message: 'Dosya yeniden adlandırıldı' });
    } catch (err) {
      setStatus({ type: 'error', message: 'Yeniden adlandırılamadı: ' + err.message });
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

    let targetPath = record?.path || '';
    if (!targetPath && record?.title) {
      const diskItem = diskFiles.find(f => normalizeName(f.name) === normalizeName(record.title));
      if (diskItem) targetPath = diskItem.path;
    }

    if (targetPath) {
      deleteDiskFile(targetPath)
        .then(() => {
          setDiskFiles(prev => prev.filter(f => f.path !== targetPath));
          setStatus({ type: 'success', message: 'Dosya ve kayıt silindi' });
        })
        .catch(() => {});
    }
  };

  const handlePlay = (item) => {
    let filePath = item?.path || '';
    if (!filePath && item?.title) {
      const diskItem = diskFiles.find(f => normalizeName(f.name) === normalizeName(item.title));
      if (diskItem) filePath = diskItem.path;
    }

    if (!filePath) {
      setStatus({ type: 'error', message: 'Dosya yolu bulunamadı' });
      return;
    }

    if (window.electronAPI?.openFile) {
      window.electronAPI.openFile(filePath)
        .then(res => {
          if (!res?.success) {
            setStatus({ type: 'error', message: 'Oynatılamadı: ' + (res?.error || '') });
          }
        })
        .catch(err => setStatus({ type: 'error', message: 'Oynatma hatası: ' + err.message }));
    } else {
      window.open('file:///' + filePath.split('\\').join('/'), '_self');
    }
  };

  const handleShowInFolder = (item) => {
    if (!window.electronAPI?.showInFolder || !item?.path) return;
    window.electronAPI.showInFolder(item.path)
      .then(res => {
        if (!res?.success) {
          setStatus({ type: 'error', message: 'Klasör açılamadı: ' + (res?.error || '') });
        }
      })
      .catch(err => setStatus({ type: 'error', message: 'Klasör hatası: ' + err.message }));
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

  const downloadAllTracks = async (format) => {
    if (!activePlaylist) return;
    const tracks = activePlaylist.tracks || [];
    if (tracks.length === 0) {
      setStatus({ type: 'error', message: 'Listede parça yok' });
      return;
    }
    const isVideo = format === 'video';
    setStatus({ type: 'info', message: `${tracks.length} parça indiriliyor...` });
    for (const track of tracks) {
      if (!track?.url) continue;
      const result = await handleDownload(track.url, isVideo ? 'video' : 'music', isVideo ? 'mp4' : 'mp3');
      if (result === 'cancelled' || result === 'error' || result === 'busy') {
        setStatus({ type: 'info', message: 'İndirme durduruldu' });
        break;
      }
    }
  };

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
            {activePlaylist.tracks.length > 0 && (
              <div className="download-all-group">
                <button className="download-all-btn" onClick={() => downloadAllTracks('music')} title="Listedeki tüm parçaları MP3 olarak indir">
                  Tümünü İndir (MP3)
                </button>
                <button className="download-all-btn video" onClick={() => downloadAllTracks('video')} title="Listedeki tüm parçaları MP4 video olarak indir">
                  Tümünü İndir (MP4)
                </button>
              </div>
            )}
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

  const renderHistorySection = () => {
    const history = [...media].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (history.length === 0 && recentlyPlayed.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">♫</div>
          <p>Henüz indirme geçmişi yok</p>
          <button className="add-btn" onClick={() => setActiveTab('myt')}>
            Aramaya Git
          </button>
        </div>
      );
    }

    const formatDate = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
      <div className="history-section">
        <div className="media-toolbar">
          <h3 className="section-title">İndirme Geçmişi ({history.length})</h3>
        </div>
        <div className="history-list">
          {history.map(item => (
            <div className="history-row" key={item.id}>
              <span className={`history-status ${item.status}`}>
                {item.status === 'completed' ? '✓' : item.status === 'error' ? '✕' : item.status === 'downloading' ? '⏳' : item.status === 'cancelled' ? '⏹' : '•'}
              </span>
              <div className="history-main">
                <span className="history-title">
                  {item.type === 'music' ? '♫ ' : '▶ '}{item.title}
                </span>
                <span className="history-sub">
                  {item.status === 'downloading' && item.progress != null ? `%${Math.round(item.progress)}` : item.format?.toUpperCase() || ''}
                  {' · '}{formatDate(item.date)}
                  {item.favorite ? ' · ★' : ''}
                </span>
              </div>
              {item.status === 'completed' && item.path && (
                <button className="folder-action history-folder" onClick={() => handleShowInFolder(item)} title="Klasörde göster">⇓</button>
              )}
            </div>
          ))}
        </div>
        {recentlyPlayed.length > 0 && (
          <>
            <div className="media-toolbar" style={{ marginTop: 16 }}>
              <h3 className="section-title">Son Oynatılanlar ({recentlyPlayed.length})</h3>
            </div>
            <div className="recent-grid">
              {recentlyPlayed.slice(0, 10).map((r, i) => (
                <div className="history-row" key={i} style={{ cursor: 'pointer' }} onClick={() => {
                  const found = allMedia.find(m => m.path === r.path || m.title === r.title);
                  if (found) playTrack(found, allMedia, allMedia.indexOf(found));
                }}>
                  <div className="history-main">
                    <span className="history-title">{r.title}</span>
                    <span className="history-sub">{r.artist || ''}{r.time ? ' · ' + formatDate(r.time) : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderMediaSection = () => {
    const isSearchActive = !!searchQuery;
    const allFiltered = isSearchActive ? displayMedia : displayMedia;
    if (allFiltered.length === 0 && !isSearchActive) {
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
      <>
        <div className="media-toolbar">
          <label className="sort-label">Sırala:</label>
          <select
            className="sort-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
          >
            <option value="date">Tarihe göre</option>
            <option value="title">Başlığa göre</option>
            <option value="size">Boyuta göre</option>
            <option value="duration">Süreye göre</option>
          </select>
          <button
            className={`add-btn ${selectMode ? 'secondary' : ''}`}
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={() => {
              setSelectMode(!selectMode);
              setSelectedItems([]);
            }}
          >
            {selectMode ? 'İptal' : 'Seç'}
          </button>
          {selectMode && selectedItems.length > 0 && (
            <button
              className="add-btn"
              style={{ background: '#d32f2f', padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => {
                if (!window.confirm(`${selectedItems.length} dosyayı silmek istediğinize emin misiniz?`)) return;
                selectedItems.forEach(id => handleDeleteMedia(id));
                setSelectedItems([]);
                setSelectMode(false);
              }}
            >
              {selectedItems.length} Sil
            </button>
          )}
        </div>
        {allFiltered.length === 0 && isSearchActive ? (
          <div className="empty-search"><p>Sonuç bulunamadı</p></div>
        ) : (
          <div className="media-grid">
            {allFiltered.map(item => (
              <MediaCard
                key={item.id}
                item={item}
                onDelete={handleDeleteMedia}
                onPlay={(it) => playTrack(it, allFiltered, allFiltered.indexOf(it))}
                onOpenFolder={handleShowInFolder}
                onCancelDownload={handleCancelDownload}
                onRename={openRenameModal}
                onAddToPlaylist={(track) => setPickerTarget(track)}
                onToggleFavorite={(id) => {
                  setMedia(prev => prev.map(m => m.id === id ? { ...m, favorite: !m.favorite } : m));
                }}
                selectMode={selectMode}
                selected={selectedItems.includes(item.id)}
                onToggleSelect={(id) => {
                  setSelectedItems(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
                }}
              />
            ))}
          </div>
        )}
      </>
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
          {updateInfo?.update_available && (
            <button
              className="update-btn"
              title={`v${updateInfo.latest} sürümü mevcut`}
              onClick={() => {
                if (window.electronAPI?.openExternal) {
                  window.electronAPI.openExternal(updateInfo.repo_url + '/releases');
                } else {
                  window.open(updateInfo.repo_url + '/releases', '_blank');
                }
              }}
            >
              ⟳ v{updateInfo.latest}
            </button>
          )}
          <button
            className="settings-btn"
            onClick={() => setShowSettingsModal(true)}
            title="Ayarlar"
          >⚙</button>
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

      {downloadQueue.length > 0 && (
        <div className="queue-panel" style={{ padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid #333' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            İndirme Kuyruğu ({downloadQueue.length})
          </div>
          {downloadQueue.slice(0, 4).map((q, i) => (
            <div className={`queue-item ${q.status === 'downloading' ? 'active' : ''} ${q.status === 'completed' ? 'completed' : ''}`} key={i}>
              <span className="queue-info">{q.title}</span>
              <span className="queue-status">{q.status === 'downloading' ? 'İndiriliyor...' : q.status === 'queued' ? 'Bekliyor' : q.status}</span>
              {q.status === 'downloading' && (
                <button className="action-btn cancel-action" style={{ width: 24, height: 24, fontSize: '0.7rem' }} onClick={() => cancelDownload()} title="İptal">✕</button>
              )}
              {q.status === 'queued' && (
                <button className="action-btn cancel-action" style={{ width: 24, height: 24, fontSize: '0.7rem' }} onClick={() => setDownloadQueue(prev => prev.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
          ))}
          {downloadQueue.length > 4 && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>...ve {downloadQueue.length - 4} tane daha</div>}
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

            {searchHistory.length > 0 && (
              <div className="history-chips">
                {searchHistory.slice(0, 8).map((q, i) => (
                  <span key={i} className="history-chip" onClick={() => handleMytSearch(q)}>
                    {q}
                    <span className="clear-chip" onClick={(e) => { e.stopPropagation(); setSearchHistory(prev => prev.filter((_, j) => j !== i)); }}>×</span>
                  </span>
                ))}
              </div>
            )}

            <div className="myt-urlbar">
              <span className="urlbar-hint">Herhangi bir linki direkt indir:</span>
              <div className="urlbar-row">
                <input
                  type="text"
                  placeholder="https://youtube.com/watch?v=... veya herhangi bir sayfa"
                  value={urlModalValue}
                  onChange={(e) => setUrlModalValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setShowUrlModal(true); } }}
                  className="myt-search-input"
                />
                <button
                  className="myt-url-btn"
                  onClick={() => setShowUrlModal(true)}
                >
                  URL ile İndir
                </button>
                <button
                  className="myt-url-btn"
                  style={{ background: 'var(--accent-purple)' }}
                  onClick={() => setShowBulkModal(true)}
                  title="Toplu URL yapıştır"
                >
                  📋
                </button>
              </div>
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
                  <button onClick={() => handleMytSearch('popular songs 2024')}>Popüler Şarkılar</button>
                  <button onClick={() => handleMytSearch('turkish music')}>Türkçe Müzik</button>
                  <button onClick={() => handleMytSearch('lofi hip hop')}>Lo-Fi Beats</button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'playlists' ? (
          renderPlaylistSection()
        ) : activeTab === 'history' ? (
          renderHistorySection()
        ) : (
          renderMediaSection()
        )}
      </main>

      {player.track && (
        <div className="player-bar">
          <audio
            ref={audioRef}
            src={player.track.path ? getStreamFileUrl(player.track.path) : ''}
            onTimeUpdate={() => {
              if (audioRef.current) {
                setPlayer(p => ({ ...p, currentTime: audioRef.current.currentTime }));
              }
            }}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                setPlayer(p => ({ ...p, duration: audioRef.current.duration }));
              }
            }}
            onEnded={() => nextTrack(1)}
            onError={() => setPlayer(p => ({ ...p, isPlaying: false }))}
            volume={player.volume}
            autoPlay
          />
          <div className="player-info">
            <span className="player-title">{player.track.title || 'Bilinmeyen'}</span>
            <span className="player-artist">{player.track.artist || '\u00A0'}</span>
          </div>
          <div className="player-controls">
            <button className="player-btn" onClick={() => { setPlayer(p => ({ ...p, shuffle: !p.shuffle })); }} style={{ color: player.shuffle ? 'var(--accent-blue)' : '' }}>🔀</button>
            <button className="player-btn" onClick={() => nextTrack(-1)}>⏮</button>
            <button className="player-btn play-btn" onClick={togglePlay}>{player.isPlaying ? '⏸' : '▶'}</button>
            <button className="player-btn" onClick={() => nextTrack(1)}>⏭</button>
            <button className="player-btn" onClick={() => { setPlayer(p => ({ ...p, repeat: p.repeat === 'none' ? 'all' : p.repeat === 'all' ? 'one' : 'none' })); }} style={{ color: player.repeat !== 'none' ? 'var(--accent-blue)' : '' }}>
              {player.repeat === 'one' ? '🔂' : player.repeat === 'all' ? '🔁' : '🔁'}
            </button>
            <button className="player-btn" onClick={() => {
              if (player.track) {
                setCurrentLyrics({ title: player.track.title, artist: player.track.artist, lyrics: '' });
                setLyricsLoading(true);
                getLyrics(player.track.title, player.track.artist)
                  .then(res => {
                    if (res?.data?.lyrics) {
                      setCurrentLyrics({ ...currentLyrics, lyrics: res.data.lyrics });
                    }
                  })
                  .catch(() => {})
                  .finally(() => setLyricsLoading(false));
                setShowLyricsModal(true);
              }
            }} title="Şarkı Sözü">
              📄
            </button>
          </div>
          <div className="player-progress">
            <span className="player-time">{formatTime(player.currentTime)}</span>
            <input
              type="range"
              className="player-slider"
              min={0}
              max={player.duration || 100}
              value={player.currentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (audioRef.current) audioRef.current.currentTime = val;
                setPlayer(p => ({ ...p, currentTime: val }));
              }}
            />
            <span className="player-time">{formatTime(player.duration)}</span>
          </div>
          <div className="player-volume">
            <button className="player-btn" style={{ width: 28, height: 28, fontSize: '0.9rem' }} onClick={() => {
              const newVol = player.volume > 0 ? 0 : 0.7;
              if (audioRef.current) audioRef.current.volume = newVol;
              setPlayer(p => ({ ...p, volume: newVol }));
            }}>{player.volume > 0 ? '🔊' : '🔇'}</button>
            <input
              type="range"
              className="player-slider"
              min={0}
              max={1}
              step={0.05}
              value={player.volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (audioRef.current) audioRef.current.volume = val;
                setPlayer(p => ({ ...p, volume: val }));
              }}
              style={{ width: 60 }}
            />
          </div>
        </div>
      )}
      <div className={player.track ? 'player-spacer' : ''}></div>

      <footer className="app-footer">
        <span style={{ cursor: 'pointer' }} onClick={() => setShowVersionModal(true)}>BlackHole Music v{appVersion}</span>
        <span
          className="footer-github"
          title="GitHub"
          onClick={() => {
            const url = 'https://github.com/ItzJPPPMe/BlackHole-Music';
            if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
            else window.open(url, '_blank');
          }}
        >GitHub</span>
      </footer>

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

      {showUrlModal && (
        <div className="modal-overlay" onClick={() => setShowUrlModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3>URL ile İndir</h3>
            <input
              type="text"
              placeholder="YouTube, Spotify, SoundCloud veya herhangi bir video/müzik linki"
              value={urlModalValue}
              onChange={(e) => {
                setUrlModalValue(e.target.value);
                setVideoPreview(null);
              }}
              className="modal-input"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && urlModalValue.trim()) { setShowUrlModal(false); setUrlModalValue(''); handleDownload(urlModalValue.trim(), urlModalQuality === 'best' ? 'video' : 'video', 'mp4', urlModalQuality); } }}
            />
            <button
              className="myt-url-btn"
              style={{ marginBottom: 12, width: '100%', textAlign: 'center', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid #444', borderRadius: 8, padding: 6 }}
              onClick={async () => {
                if (!urlModalValue.trim()) return;
                setPreviewLoading(true);
                try {
                  const res = await getVideoInfo(urlModalValue.trim());
                  setVideoPreview(res?.data || null);
                } catch { setStatus({ type: 'error', message: 'Önizleme alınamadı' }); }
                setPreviewLoading(false);
              }}
            >
              {previewLoading ? 'Yükleniyor...' : 'ℹ Önizleme Göster'}
            </button>
            {videoPreview && (
              <div className="video-preview">
                {videoPreview.thumbnail && <img className="preview-thumb" src={videoPreview.thumbnail} alt="" />}
                <div className="preview-title">{videoPreview.title || ''}</div>
                <div className="preview-details">
                  <span>📺 {videoPreview.uploader || ''}</span>
                  <span>⏱ {videoPreview.duration || ''}</span>
                  <span>📅 {videoPreview.upload_date || ''}</span>
                  {videoPreview.view_count != null && <span>👁 {videoPreview.view_count.toLocaleString()}</span>}
                </div>
                {videoPreview.formats && videoPreview.formats.length > 0 && (
                  <>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mevcut formatlar:</span>
                    <div className="preview-format-list">
                      {videoPreview.formats.slice(0, 10).map((f, i) => (
                        <span key={i} className="preview-format">{f.label || f.format_id}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <label className="settings-label">Video Kalitesi</label>
            <select
              className="modal-input"
              value={urlModalQuality}
              onChange={(e) => setUrlModalQuality(e.target.value)}
            >
              <option value="best">En iyi kalite</option>
              <option value="2160">4K</option>
              <option value="1440">1440p</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="360">360p</option>
            </select>
            <div className="modal-buttons">
              <button
                className="modal-btn music-btn"
                onClick={() => {
                  const u = urlModalValue.trim();
                  setShowUrlModal(false);
                  setUrlModalValue('');
                  setVideoPreview(null);
                  handleDownload(u, 'music', 'mp3');
                }}
              >♫ Müzik indir</button>
              <button
                className="modal-btn video-btn"
                onClick={() => {
                  const u = urlModalValue.trim();
                  setShowUrlModal(false);
                  setUrlModalValue('');
                  setVideoPreview(null);
                  handleDownload(u, 'video', 'mp4', urlModalQuality);
                }}
              >▶ Video indir</button>
              <button className="modal-btn cancel-btn" onClick={() => setShowUrlModal(false)}>İptal</button>
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

      {showRenameModal && (
        <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Dosyayı Yeniden Adlandır</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="modal-input"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); }}
              placeholder="Yeni dosya adı"
            />
            <div className="modal-buttons">
              <button className="modal-btn save-btn" onClick={submitRename}>Kaydet</button>
              <button className="modal-btn cancel-btn" onClick={() => setShowRenameModal(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3>Toplu URL Yapıştır</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              Her satıra bir URL yazın veya yapıştırın. Tüm URL'ler sırayla indirilecek.
            </p>
            <textarea
              className="bulk-textarea"
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              placeholder={`https://youtube.com/watch?v=...\nhttps://youtube.com/watch?v=...\nhttps://soundcloud.com/...`}
            />
            {bulkUrls.trim() && (
              <div className="bulk-count">{bulkUrls.trim().split('\n').filter(l => l.trim()).length} URL bulundu</div>
            )}
            <div className="modal-buttons">
              <button className="modal-btn video-btn" disabled={!bulkUrls.trim()} onClick={() => {
                const urls = bulkUrls.trim().split('\n').filter(l => l.trim()).map(u => u.trim());
                urls.forEach(u => addToQueue(u, 'video', 'mp4'));
                setBulkUrls('');
                setShowBulkModal(false);
                setStatus({ type: 'info', message: `${urls.length} URL kuyruğa eklendi` });
              }}>Video (MP4) indir</button>
              <button className="modal-btn music-btn" disabled={!bulkUrls.trim()} onClick={() => {
                const urls = bulkUrls.trim().split('\n').filter(l => l.trim()).map(u => u.trim());
                urls.forEach(u => addToQueue(u, 'music', 'mp3'));
                setBulkUrls('');
                setShowBulkModal(false);
                setStatus({ type: 'info', message: `${urls.length} URL kuyruğa eklendi` });
              }}>Müzik (MP3) indir</button>
              <button className="modal-btn cancel-btn" onClick={() => setShowBulkModal(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {showLyricsModal && (
        <div className="modal-overlay" onClick={() => setShowLyricsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>Şarkı Sözü</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentLyrics.title} - {currentLyrics.artist}</span>
            </div>
            <div className="lyrics-container" style={{ maxHeight: '400px', overflowY: 'auto', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {lyricsLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>Yükleniyor...</div>
              ) : currentLyrics.lyrics ? (
                <div>{currentLyrics.lyrics.split('\n').map((line, i) => <div key={i} style={{ marginBottom: 6 }}>{line}</div>)}</div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Şarkı sözü bulunamadı.</div>
              )}
            </div>
            <div className="modal-buttons" style={{ marginTop: 16 }}>
              <button className="modal-btn cancel-btn" onClick={() => setShowLyricsModal(false)} style={{ width: '100%' }}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Ayarlar</h3>
            <label className="settings-label">Uygulama Rengi</label>
            <div className="theme-grid">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-swatch ${settingsTheme === t.id ? 'active' : ''}`}
                  style={{ background: t.color }}
                  onClick={() => setSettingsTheme(t.id)}
                  title={t.label}
                >
                  {settingsTheme === t.id ? '✓' : ''}
                </button>
              ))}
            </div>
            <label className="settings-label">Görünüm</label>
            <div className="layout-toggle">
              <button
                className={`layout-btn ${darkMode ? 'active' : ''}`}
                onClick={() => setDarkMode(true)}
              >
                🌙 Koyu
              </button>
              <button
                className={`layout-btn ${!darkMode ? 'active' : ''}`}
                onClick={() => setDarkMode(false)}
              >
                ☀ Aydınlık
              </button>
            </div>
            <label className="settings-label">Video Kalitesi</label>
            <select
              className="modal-input"
              value={appSettings?.video_quality || 'best'}
              onChange={(e) => setAppSettings(prev => ({ ...(prev || {}), video_quality: e.target.value }))}
            >
              <option value="best">En iyi kalite</option>
              <option value="2160">4K</option>
              <option value="1440">1440p</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="360">360p</option>
            </select>
            <label className="settings-label">Hız Sınırı (opsiyonel, örn: 500K, 5M)</label>
            <input
              type="text"
              className="modal-input"
              placeholder="Boş bırakılırsa sınırsız"
              value={appSettings?.rate_limit || ''}
              onChange={(e) => setAppSettings(prev => ({ ...(prev || {}), rate_limit: e.target.value }))}
            />
            <label className="settings-label">Ses Kalitesi (0=en iyi, 5=orta, 10=düşük)</label>
            <input
              type="text"
              className="modal-input"
              placeholder="0 (en iyi)"
              value={appSettings?.audio_bitrate || '0'}
              onChange={(e) => setAppSettings(prev => ({ ...(prev || {}), audio_bitrate: e.target.value }))}
            />
            <label className="settings-label">
              <input
                type="checkbox"
                checked={appSettings?.subtitles || false}
                onChange={(e) => setAppSettings(prev => ({ ...(prev || {}), subtitles: e.target.checked }))}
                style={{ marginRight: 6 }}
              />
              Altyazıları da indir
            </label>
            <label className="settings-label">Altyazı Dilleri</label>
            <input
              type="text"
              className="modal-input"
              placeholder="tr,en,en.*"
              value={appSettings?.sub_langs || 'tr,en,en.*'}
              onChange={(e) => setAppSettings(prev => ({ ...(prev || {}), sub_langs: e.target.value }))}
            />
            <label className="settings-label">Video Klasörü</label>
            <div className="folder-row">
              <input
                type="text"
                className="modal-input folder-input"
                value={appSettings?.video_dir || ''}
                placeholder="Video dosyalarının kaydedileceği klasör"
                onChange={(e) => setAppSettings(prev => ({ ...(prev || {}), video_dir: e.target.value }))}
              />
              <button className="folder-select-btn" onClick={async () => {
                if (!window.electronAPI?.selectFolder) return;
                const dir = await window.electronAPI.selectFolder();
                if (dir) setAppSettings(prev => ({ ...(prev || {}), video_dir: dir }));
              }}>Gözat</button>
            </div>
            <label className="settings-label">Müzik Klasörü</label>
            <div className="folder-row">
              <input
                type="text"
                className="modal-input folder-input"
                value={appSettings?.music_dir || ''}
                placeholder="Müzik dosyalarının kaydedileceği klasör"
                onChange={(e) => setAppSettings(prev => ({ ...(prev || {}), music_dir: e.target.value }))}
              />
              <button className="folder-select-btn" onClick={async () => {
                if (!window.electronAPI?.selectFolder) return;
                const dir = await window.electronAPI.selectFolder();
                if (dir) setAppSettings(prev => ({ ...(prev || {}), music_dir: dir }));
              }}>Gözat</button>
            </div>
            <div className="modal-buttons">
              <button className="modal-btn save-btn" onClick={async () => {
                try {
                  const payload = {
                    video_dir: appSettings?.video_dir || 'C:\\Video_Indirici',
                    music_dir: appSettings?.music_dir || 'C:\\Video_Indirici',
                    theme: settingsTheme,
                    video_quality: appSettings?.video_quality || 'best',
                    dark_mode: darkMode,
                    rate_limit: appSettings?.rate_limit || '',
                    audio_bitrate: appSettings?.audio_bitrate || '0',
                    subtitles: appSettings?.subtitles || false,
                    sub_langs: appSettings?.sub_langs || 'tr,en,en.*',
                    embed_thumbnail: true,
                    add_metadata: true,
                    concurrent_fragments: 8,
                    verify_ssl: true,
                    prefer_av1: false,
                  };
                  await updateAppSettings(payload);
                  setAppSettings(payload);
                  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
                  if (window.electronAPI?.notify) window.electronAPI.notify('Ayarlar kaydedildi', '');
                  setStatus({ type: 'success', message: 'Ayarlar kaydedildi' });
                } catch (err) {
                  setStatus({ type: 'error', message: 'Ayarlar kaydedilemedi: ' + err.message });
                }
                setShowSettingsModal(false);
              }}>Kaydet</button>
              <button className="modal-btn cancel-btn" onClick={() => setShowSettingsModal(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}