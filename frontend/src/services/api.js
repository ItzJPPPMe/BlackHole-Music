const API_BASE = window.location.protocol === 'file:'
  ? 'http://127.0.0.1:3000/api'
  : '/api';

async function handleResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'İstek başarısız oldu.');
  }
  return data;
}

export async function requestDownload(url, quality, format, folder, downloadType, albumStructure) {
  const response = await fetch(`${API_BASE}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, quality, format, folder, download_type: downloadType, album_structure: albumStructure }),
  });
  return handleResponse(response);
}

export async function requestPlaylistDownload(url, quality, format, folder, albumStructure, trackIndices) {
  const response = await fetch(`${API_BASE}/playlist/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, quality, format, folder, album_structure: albumStructure, track_indices: trackIndices }),
  });
  return handleResponse(response);
}

export async function requestStreamDownload(url, quality, format, folder) {
  const response = await fetch(`${API_BASE}/stream/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, quality, format, folder }),
  });
  return handleResponse(response);
}

export async function getPlaylistInfo(url) {
  const response = await fetch(`${API_BASE}/playlist/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return handleResponse(response);
}

export async function getStreamInfo(url) {
  const response = await fetch(`${API_BASE}/stream/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return handleResponse(response);
}

export async function getDownloads() {
  const response = await fetch(`${API_BASE}/downloads`);
  return handleResponse(response);
}

export async function getDownloadById(id) {
  const response = await fetch(`${API_BASE}/downloads/${id}`);
  return handleResponse(response);
}

export async function searchMusic(query, limit = 10) {
  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });
  return handleResponse(response);
}

export async function getDiskFiles() {
  const response = await fetch(`${API_BASE}/files`);
  return handleResponse(response);
}

export async function getDownloadProgress() {
  const response = await fetch(`${API_BASE}/downloads/progress`);
  return handleResponse(response);
}

export async function cancelDownload() {
  const response = await fetch(`${API_BASE}/downloads/cancel`, {
    method: 'POST',
  });
  return handleResponse(response);
}

export async function deleteDiskFile(path) {
  const response = await fetch(`${API_BASE}/files/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return handleResponse(response);
}

export async function renameDiskFile(path, newName) {
  const response = await fetch(`${API_BASE}/files/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, new_name: newName }),
  });
  return handleResponse(response);
}

export async function getAppSettings() {
  const response = await fetch(`${API_BASE}/settings`);
  return handleResponse(response);
}

export async function updateAppSettings(settings) {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return handleResponse(response);
}

export async function getAppVersion() {
  const response = await fetch(`${API_BASE}/version`);
  return handleResponse(response);
}

export async function checkForUpdate() {
  const response = await fetch(`${API_BASE}/update/check`);
  return handleResponse(response);
}

export async function getVideoInfo(url) {
  const response = await fetch(`${API_BASE}/video/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return handleResponse(response);
}

export async function startBatchDownload(items) {
  const response = await fetch(`${API_BASE}/downloads/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return handleResponse(response);
}

export async function getStreamFileUrl(path) {
  return `${API_BASE}/files/stream?path=${encodeURIComponent(path)}`;
}

export async function getLyrics(title, artist) {
  const response = await fetch(`${API_BASE}/lyrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, artist, duration: 0 }),
  });
  return handleResponse(response);
}
