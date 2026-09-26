use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use crate::{
    config::Config,
    errors::AppError,
    models::{
        download::{
            BatchRequest, DiskFile, DownloadItem, DownloadRequest, PlaylistRequest, SearchRequest,
            StreamRequest, VideoInfoRequest,
        },
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
        .start_playlist_download(
            &payload.url,
            &quality,
            &format,
            &folder,
            album_structure,
            payload.track_indices,
        )
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

pub async fn get_video_info(
    Json(payload): Json<VideoInfoRequest>,
) -> Result<impl IntoResponse, AppError> {
    if payload.url.trim().is_empty() {
        return Err(AppError::InvalidUrl);
    }

    let service = DownloadService::new();
    let info = service.get_video_info(&payload.url).await?;

    let response = ApiResponse::success(info, "Video bilgisi");
    Ok(Json(response))
}

pub async fn start_batch_download(
    State(_): State<Config>,
    Json(payload): Json<BatchRequest>,
) -> Result<impl IntoResponse, AppError> {
    if payload.items.is_empty() {
        return Err(AppError::InvalidUrl);
    }

    let current = settings::load();
    let service = DownloadService::new();
    let mut results: Vec<serde_json::Value> = Vec::new();

    for item in payload.items {
        let quality = item.quality.unwrap_or_else(|| "best".to_string());
        let format = item.format.unwrap_or_else(|| "mp4".to_string());
        let download_type = item.download_type.unwrap_or_else(|| "video".to_string());
        let folder = item.folder.unwrap_or_else(|| {
            if download_type == "music" {
                current.music_dir.clone()
            } else {
                current.video_dir.clone()
            }
        });

        let result = if item.track_indices.is_some() {
            service
                .start_playlist_download(
                    &item.url,
                    &quality,
                    &format,
                    &folder,
                    item.album_structure.unwrap_or(false),
                    item.track_indices,
                )
                .await
        } else if download_type == "stream" {
            service
                .start_stream_download(&item.url, &quality, &format, &folder)
                .await
        } else {
            service
                .start_download(&item.url, &quality, &format, &folder)
                .await
        };

        match result {
            Ok(file_path) => results.push(serde_json::json!({
                "url": item.url,
                "success": true,
                "path": file_path,
            })),
            Err(e) => results.push(serde_json::json!({
                "url": item.url,
                "success": false,
                "error": e.to_string(),
            })),
        }
    }

    let response = ApiResponse::success(results, "Toplu indirme tamamlandı");
    Ok(Json(response))
}

pub async fn stream_file(
    Query(params): Query<std::collections::HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let Some(path) = params.get("path") else {
        return fat_message("path parametresi eksik");
    };

    let current = settings::load();
    let legacy_dir = "C:\\Video İndirici".to_string();
    let target = std::path::Path::new(path);
    let in_video = target.starts_with(&current.video_dir);
    let in_music = target.starts_with(&current.music_dir);
    let in_legacy = target.starts_with(&legacy_dir);
    if !in_video && !in_music && !in_legacy {
        return fat_message("Erişim reddedildi");
    }
    if !target.is_file() {
        return fat_message("Dosya bulunamadı");
    }

    let size = match std::fs::metadata(target) {
        Ok(m) => m.len(),
        Err(_) => return fat_message("Meta veri okunamadı"),
    };

    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(parse_range)
        .map(|(start, end)| (start, end.min(size.saturating_sub(1))));

    let (start, end, status) = match range {
        Some((s, e)) if e >= s && s < size => (s, e, StatusCode::PARTIAL_CONTENT),
        _ => (0, size.saturating_sub(1), StatusCode::OK),
    };

    let data = match std::fs::read(target) {
        Ok(bytes) => bytes,
        Err(_) => return fat_message("Dosya okunamadı"),
    };
    let data = data[(start as usize)..=(end as usize)].to_vec();

    let content_type = mime_from_ext(
        target
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("mp4"),
    );

    let mut builder = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_RANGE,
            format!("bytes {}-{}/{}", start, end, size),
        )
        .header(header::ACCEPT_RANGES, "bytes");

    if status == StatusCode::PARTIAL_CONTENT {
        builder = builder.header(header::CONTENT_LENGTH, data.len().to_string());
    }

    builder
        .body(Body::from(data))
        .unwrap_or_else(|_| fat_message("Yanıt oluşturulamadı"))
}

fn parse_range(range: &str) -> Option<(u64, u64)> {
    let spec = range.strip_prefix("bytes=")?;
    let (start, end) = spec.split_once('-')?;
    let start: u64 = start.trim().parse().ok()?;
    let end: u64 = if end.is_empty() {
        start + (2 * 1024 * 1024)
    } else {
        end.trim().parse().ok()?
    };
    Some((start, end))
}

fn fat_message(msg: &str) -> Response {
    Response::builder()
        .status(StatusCode::BAD_REQUEST)
        .body(Body::from(msg.to_string()))
        .unwrap_or_else(|_| Response::new(Body::from("hata")))
}

fn mime_from_ext(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "m4a" | "aac" => "audio/mp4",
        "ogg" | "opus" => "audio/ogg",
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        _ => "application/octet-stream",
    }
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

pub async fn get_download_progress() -> Result<impl IntoResponse, AppError> {
    let info = crate::services::download_service::get_progress();
    let response = ApiResponse::success(
        serde_json::json!({ "progress": info.percent, "speed": info.speed, "eta": info.eta }),
        "İndirme durumu",
    );
    Ok(Json(response))
}

pub async fn cancel_current_download() -> Result<impl IntoResponse, AppError> {
    let cancelled = crate::services::download_service::cancel_download().await;
    let response = ApiResponse::success(
        serde_json::json!({ "cancelled": cancelled }),
        if cancelled { "İndirme iptal edildi" } else { "Aktif indirme bulunamadı" },
    );
    Ok(Json(response))
}

pub async fn list_files(
    State(config): State<Config>,
) -> Result<impl IntoResponse, AppError> {
    use std::fs;

    let current = settings::load();
    let mut files: Vec<DiskFile> = Vec::new();
    let legacy_dir = "C:\\Video İndirici".to_string();
    let allowed: Vec<String> = vec![
        current.video_dir.clone(),
        current.music_dir.clone(),
        config.download_dir.clone(),
        config.music_dir.clone(),
        legacy_dir,
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
    let legacy_dir = "C:\\Video İndirici".to_string();
    let in_download = target.starts_with(&current.video_dir);
    let in_music = target.starts_with(&current.music_dir);
    let in_legacy = target.starts_with(&legacy_dir);
    if !in_download && !in_music && !in_legacy {
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

pub async fn rename_file(
    Json(payload): Json<serde_json::Value>,
) -> Result<impl IntoResponse, AppError> {
    let path = payload["path"].as_str().unwrap_or("");
    let new_name = payload["new_name"].as_str().unwrap_or("").trim();
    if path.trim().is_empty() || new_name.is_empty() {
        return Err(AppError::InvalidUrl);
    }
    if new_name.contains("/") || new_name.contains("\\") || new_name.contains("..") {
        return Err(AppError::InvalidUrl);
    }

    let target = std::path::Path::new(path);
    let current = settings::load();
    let legacy_dir = "C:\\Video İndirici".to_string();
    let in_download = target.starts_with(&current.video_dir);
    let in_music = target.starts_with(&current.music_dir);
    let in_legacy = target.starts_with(&legacy_dir);
    if !in_download && !in_music && !in_legacy {
        return Err(AppError::InvalidUrl);
    }
    if !target.is_file() {
        return Err(AppError::InternalError);
    }

    let parent = target.parent().ok_or(AppError::InternalError)?;
    let new_path = parent.join(new_name);
    if new_path.exists() {
        return Err(AppError::InternalError);
    }

    std::fs::rename(path, &new_path).map_err(|_| AppError::InternalError)?;

    let response = ApiResponse::success(
        serde_json::json!({
            "path": new_path.to_string_lossy().to_string(),
            "name": new_name,
        }),
        "Dosya yeniden adlandırıldı",
    );
    Ok(Json(response))
}

pub async fn get_lyrics(
    Json(payload): Json<serde_json::Value>,
) -> Result<impl IntoResponse, AppError> {
    let title = payload["title"].as_str().ok_or(AppError::InvalidUrl)?;
    let artist = payload["artist"].as_str().ok_or(AppError::InvalidUrl)?;
    let duration = payload["duration"].as_f64().unwrap_or(0.0);

    let client = reqwest::Client::new();
    let url = format!("https://lyrics.ovh/api/search?q={}", urlencode(&format!("{} - {}", artist, title)));

    let lyrics_response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| AppError::DownloadFailed(format!("Lyrics API çağrısı başarısız: {}", e)))?;

    if !lyrics_response.status().is_success() {
        return Ok(ApiResponse::success(
            serde_json::json!({
                "lyrics": "Çeviri bulunamadı.",
                "error": "API erişim hatası",
            }),
            "Şarkı sözü"
        ));
    }

    let lyrics_data: serde_json::Value = lyrics_response
        .json()
        .await
        .map_err(|e| AppError::DownloadFailed(format!("Lyrics API yanıtı ayrıştırılamadı: {}", e)))?;

    let lyrics = if let Some(lines) = lyrics_data.get("data") {
        lines.as_str().unwrap_or("").to_string()
    } else {
        "Çeviri bulunamadı.".to_string()
    };

    let response = ApiResponse::success(
        serde_json::json!({
            "lyrics": lyrics,
            "title": title,
            "artist": artist,
            "duration": duration,
            "source": "lyrics.ovh",
        }),
        "Şarkı sözü"
    );
    Ok(Json(response))
}

fn urlencode(s: &str) -> String {
    s.replace(' ', '+')
}
