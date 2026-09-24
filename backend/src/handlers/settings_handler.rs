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
    };

    let _ = std::fs::create_dir_all(&updated.video_dir);
    let _ = std::fs::create_dir_all(&updated.music_dir);

    settings::save(&updated)
        .map_err(|_| AppError::InternalError)?;

    let response = ApiResponse::success(updated, "Ayarlar kaydedildi");
    Ok(Json(response))
}