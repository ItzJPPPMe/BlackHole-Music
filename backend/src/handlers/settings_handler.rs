use axum::{Json, response::IntoResponse};
use crate::{
    errors::AppError,
    models::response::ApiResponse,
    settings,
};

pub async fn get_settings() -> Result<impl IntoResponse, AppError> {
    let current = settings::load();
    let response = ApiResponse::success(current, "Ayarlar getirildi");
    Ok(Json(response))
}

pub async fn update_settings(
    Json(payload): Json<settings::Settings>,
) -> Result<impl IntoResponse, AppError> {
    let current = settings::load();
    let updated = settings::Settings {
        video_dir: if payload.video_dir.trim().is_empty() {
            "C:\\Video_Indirici".to_string()
        } else {
            payload.video_dir
        },
        music_dir: if payload.music_dir.trim().is_empty() {
            "C:\\Video_Indirici".to_string()
        } else {
            payload.music_dir
        },
        theme: if payload.theme.trim().is_empty() {
            "blue".to_string()
        } else {
            payload.theme
        },
        video_quality: if payload.video_quality.trim().is_empty() {
            "best".to_string()
        } else {
            payload.video_quality
        },
        dark_mode: payload.dark_mode,
        rate_limit: payload.rate_limit,
        audio_bitrate: if payload.audio_bitrate.trim().is_empty() {
            "0".to_string()
        } else {
            payload.audio_bitrate
        },
        subtitles: payload.subtitles,
        sub_langs: if payload.sub_langs.trim().is_empty() {
            "tr,en,en.*".to_string()
        } else {
            payload.sub_langs
        },
        embed_thumbnail: payload.embed_thumbnail,
        add_metadata: payload.add_metadata,
        concurrent_fragments: if payload.concurrent_fragments == 0 {
            current.concurrent_fragments
        } else {
            payload.concurrent_fragments
        },
        verify_ssl: payload.verify_ssl,
        prefer_av1: payload.prefer_av1,
    };

    let _ = std::fs::create_dir_all(&updated.video_dir);
    let _ = std::fs::create_dir_all(&updated.music_dir);

    settings::save(&updated)
        .map_err(|_| AppError::InternalError)?;

    let response = ApiResponse::success(updated, "Ayarlar kaydedildi");
    Ok(Json(response))
}