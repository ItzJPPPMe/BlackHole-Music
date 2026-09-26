use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Clone)]
pub struct DownloadRequest {
    pub url: String,
    pub quality: Option<String>,
    pub format: Option<String>,
    pub folder: Option<String>,
    pub download_type: Option<String>,
    pub album_structure: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct DownloadItem {
    pub id: i64,
    pub url: String,
    pub title: Option<String>,
    pub status: String,
    pub progress: f32,
    pub download_type: Option<String>,
    pub download_path: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PlaylistRequest {
    pub url: String,
    pub format: Option<String>,
    pub quality: Option<String>,
    pub folder: Option<String>,
    pub album_structure: Option<bool>,
    pub track_indices: Option<Vec<usize>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistInfo {
    pub title: String,
    pub url: String,
    pub track_count: usize,
    pub tracks: Vec<PlaylistTrack>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistTrack {
    pub index: usize,
    pub title: String,
    pub url: String,
    pub duration: Option<String>,
    pub uploader: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlbumInfo {
    pub artist: String,
    pub album: String,
    pub year: Option<String>,
    pub track_count: usize,
    pub tracks: Vec<PlaylistTrack>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamInfo {
    pub title: String,
    pub url: String,
    pub platform: String,
    pub streamer: String,
    pub duration: Option<String>,
    pub date: Option<String>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StreamRequest {
    pub url: String,
    pub quality: Option<String>,
    pub format: Option<String>,
    pub folder: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct VideoInfoRequest {
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct BatchItem {
    pub url: String,
    pub quality: Option<String>,
    pub format: Option<String>,
    pub folder: Option<String>,
    pub download_type: Option<String>,
    pub album_structure: Option<bool>,
    pub track_indices: Option<Vec<usize>>,
}

#[derive(Debug, Deserialize)]
pub struct BatchRequest {
    pub items: Vec<BatchItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: Option<String>,
    pub duration: Option<String>,
    pub uploader: Option<String>,
    pub platform: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiskFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub file_type: String,
    pub modified_at: String,
}
