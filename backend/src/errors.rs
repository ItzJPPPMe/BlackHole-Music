use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("İndirme hatası: {0}")]
    DownloadFailed(String),

    #[error("Geçersiz URL formatı")]
    InvalidUrl,

    #[error("Playlist bulunamadı")]
    PlaylistNotFound,

    #[error("Albüm bilgisi alınamadı")]
    AlbumError,

    #[error("Veritabanı hatası: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Bilinmeyen bir hata oluştu")]
    InternalError,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::InvalidUrl | AppError::PlaylistNotFound | AppError::AlbumError => {
                (StatusCode::BAD_REQUEST, self.to_string())
            }
            AppError::DownloadFailed(ref msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::DatabaseError(_) | AppError::InternalError => {
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
        };

        let body = Json(json!({
            "error": error_message
        }));

        (status, body).into_response()
    }
}
