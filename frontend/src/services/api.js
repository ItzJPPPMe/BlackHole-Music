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

export async function requestPlaylistDownload(url, quality, format, folder, albumStructure) {
  const response = await fetch(`${API_BASE}/playlist/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, quality, format, folder, album_structure: albumStructure }),
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

export async function deleteDiskFile(path) {
  const response = await fetch(`${API_BASE}/files/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return handleResponse(response);
}
