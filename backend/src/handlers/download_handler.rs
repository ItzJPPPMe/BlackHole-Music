use axum::{extract::State, Json, response::IntoResponse};
use crate::{
    config::Config,
    errors::AppError,
    models::{
        download::{DiskFile, DownloadItem, DownloadRequest, PlaylistRequest, SearchRequest, StreamRequest},
        response::ApiResponse,
    },
    services::download_service::DownloadService,
    settings,
};

pub async fn start_download(
    State(_): State<Config>,
    Json(payload): Json<DownloadRequest>,
) -> Result<impl IntoResponse, AppError> {
    if payload.url.trim().is_empty() {
        return Err(AppError::InvalidUrl);
    }

    let quality = payload.quality.unwrap_or_else(|| "best".to_string());
    let format = payload.format.unwrap_or_else(|| "mp4".to_string());
    let current = settings::load();
    let folder = payload.folder.unwrap_or_else(|| {
        if payload.download_type.as_deref() == Some("music") {
            current.music_dir.clone()
        } else {
            current.video_dir.clone()
        }
    });
    let download_type = payload.download_type.unwrap_or_else(|| "video".to_string());

    let service = DownloadService::new();
    let file_path = match download_type.as_str() {
        "stream" => service.start_stream_download(&payload.url, &quality, &format, &folder).await?,
        _ => service.start_download(&payload.url, &quality, &format, &folder).await?,
    };

    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| file_path.clone());

    let item = DownloadItem {
        id: 0,
        url: payload.url,
        title: Some(file_name),
        status: "completed".to_string(),
        progress: 100.0,
        download_type: Some(download_type),
        download_path: Some(file_path),
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    let response = ApiResponse::success(item, "İndirme başarıyla tamamlandı");
    Ok(Json(response))
}

pub async fn start_playlist_download(
    State(_): State<Config>,
    Json(payload): Json<PlaylistRequest>,
) -> Result<impl IntoResponse, AppError> {
    if payload.url.trim().is_empty() {
        return Err(AppError::InvalidUrl);
    }

    let quality = payload.quality.unwrap_or_else(|| "best".to_string());
    let format = payload.format.unwrap_or_else(|| "mp3".to_string());
    let current = settings::load();
    let folder = payload.folder.unwrap_or_else(|| current.music_dir.clone());
    let album_structure = payload.album_structure.unwrap_or(false);

    let service = DownloadService::new();
    let file_path = service
        .start_playlist_download(&payload.url, &quality, &format, &folder, album_structure)
        .await?;

    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| file_path.clone());

    let item = DownloadItem {
        id: 0,
        url: payload.url,
        title: Some(file_name),
        status: "completed".to_string(),
        progress: 100.0,
        download_type: Some("playlist".to_string()),
        download_path: Some(file_path),
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    let response = ApiResponse::success(item, "Playlist indirme tamamlandı");
    Ok(Json(response))
}

pub async fn start_stream_download(
    State(_): State<Config>,
    Json(payload): Json<StreamRequest>,
) -> Result<impl IntoResponse, AppError> {
    if payload.url.trim().is_empty() {
        return Err(AppError::InvalidUrl);
    }

    let quality = payload.quality.unwrap_or_else(|| "best".to_string());
    let format = payload.format.unwrap_or_else(|| "mp4".to_string());
    let current = settings::load();
    let folder = payload.folder.unwrap_or_else(|| current.video_dir.clone());

    let service = DownloadService::new();
    let file_path = service.start_stream_download(&payload.url, &quality, &format, &folder).await?;

    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| file_path.clone());

    let item = DownloadItem {
        id: 0,
        url: payload.url,
        title: Some(file_name),
        status: "completed".to_string(),
        progress: 100.0,
        download_type: Some("stream".to_string()),
        download_path: Some(file_path),
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    let response = ApiResponse::success(item, "Yayın tekrarı indirildi");
    Ok(Json(response))
}

pub async fn get_playlist_info(
    Json(payload): Json<serde_json::Value>,
) -> Result<impl IntoResponse, AppError> {
    let url = payload["url"].as_str().ok_or(AppError::InvalidUrl)?;

    if url.trim().is_empty() {
        return Err(AppError::InvalidUrl);
    }

    let service = DownloadService::new();
    let info = service.get_playlist_info(url).await?;

    let response = ApiResponse::success(info, "Playlist bilgisi");
    Ok(Json(response))
}

pub async fn get_stream_info(
    Json(payload): Json<serde_json::Value>,
) -> Result<impl IntoResponse, AppError> {
    let url = payload["url"].as_str().ok_or(AppError::InvalidUrl)?;

    if url.trim().is_empty() {
        return Err(AppError::InvalidUrl);
    }

    let service = DownloadService::new();
    let info = service.get_stream_info(url).await?;

    let response = ApiResponse::success(info, "Yayın bilgisi");
    Ok(Json(response))
}

pub async fn get_downloads() -> Result<impl IntoResponse, AppError> {
    let downloads: Vec<DownloadItem> = Vec::new();
    let response = ApiResponse::success(downloads, "İndirme listesi");
    Ok(Json(response))
}

pub async fn get_download_by_id(
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    let item = DownloadItem {
        id,
        url: String::new(),
        title: None,
        status: "unknown".to_string(),
        progress: 0.0,
        download_type: None,
        download_path: None,
        created_at: String::new(),
    };
    let response = ApiResponse::success(item, "İndirme detayı");
    Ok(Json(response))
}

pub async fn search_music(
    Json(payload): Json<SearchRequest>,
) -> Result<impl IntoResponse, AppError> {
    if payload.query.trim().is_empty() {
        return Err(AppError::InvalidUrl);
    }

    let limit = payload.limit.unwrap_or(10);
    let service = DownloadService::new();
    let results = service.search(&payload.query, limit).await?;

    let response = ApiResponse::success(results, "Arama sonuçları");
    Ok(Json(response))
}

fn file_type_from_ext(ext: &str) -> &'static str {
    match ext {
        "mp4" | "webm" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "m4v" | "mpg" | "mpeg" | "ts" => "video",
        "mp3" | "m4a" | "wav" | "flac" | "ogg" | "aac" | "opus" | "wma" => "music",
        _ => "video",
    }
}

fn is_media_ext(ext: &str) -> bool {
    matches!(
        ext,
        "mp4" | "webm" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "m4v" | "mpg" | "mpeg" | "ts"
            | "mp3" | "m4a" | "wav" | "flac" | "ogg" | "aac" | "opus" | "wma"
    )
}

pub async fn list_files(
    State(config): State<Config>,
) -> Result<impl IntoResponse, AppError> {
    use std::fs;

    let current = settings::load();
    let mut files: Vec<DiskFile> = Vec::new();
    let allowed: Vec<String> = vec![
        current.video_dir.clone(),
        current.music_dir.clone(),
        config.download_dir.clone(),
        config.music_dir.clone(),
    ];
    let mut dirs: Vec<String> = Vec::new();
    for d in allowed {
        if !dirs.contains(&d) {
            dirs.push(d);
        }
    }

    for dir in dirs {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let Some(name_os) = path.file_name() else {
                continue;
            };
            let name = name_os.to_string_lossy().to_string();
            let Some(ext_os) = path.extension() else {
                continue;
            };
            let ext = ext_os.to_string_lossy().to_lowercase();
            if !is_media_ext(&ext) {
                continue;
            }
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let modified_at = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|sys| chrono::DateTime::<chrono::Local>::from(sys).to_rfc3339())
                .unwrap_or_default();

            files.push(DiskFile {
                name: name.clone(),
                path: path.to_string_lossy().to_string(),
                size,
                file_type: file_type_from_ext(&ext).to_string(),
                modified_at,
            });
        }
    }

    files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    let response = ApiResponse::success(files, "Dosya listesi");
    Ok(Json(response))
}

pub async fn delete_file(
    State(_): State<Config>,
    Json(payload): Json<serde_json::Value>,
) -> Result<impl IntoResponse, AppError> {
    let path = payload["path"].as_str().unwrap_or("");
    if path.trim().is_empty() {
        return Err(AppError::InvalidUrl);
    }

    let target = std::path::Path::new(path);
    let current = settings::load();
    let in_download = target.starts_with(&current.video_dir);
    let in_music = target.starts_with(&current.music_dir);
    if !in_download && !in_music {
        return Err(AppError::InvalidUrl);
    }
    if !target.is_file() {
        return Err(AppError::InternalError);
    }

    std::fs::remove_file(path)
        .map_err(|_| AppError::InternalError)?;

    let response = ApiResponse::success(true, "Dosya silindi");
    Ok(Json(response))
}
