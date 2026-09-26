use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;
use crate::{config::Config, handlers::{download_handler, settings_handler, update_handler}};

pub fn create_router(config: Config) -> Router {
    let cors = CorsLayer::permissive();

    Router::new()
        .route("/api/download", post(download_handler::start_download))
        .route("/api/downloads", get(download_handler::get_downloads))
        .route("/api/downloads/:id", get(download_handler::get_download_by_id))
        .route("/api/downloads/progress", get(download_handler::get_download_progress))
        .route("/api/downloads/cancel", post(download_handler::cancel_current_download))
        .route("/api/playlist/info", post(download_handler::get_playlist_info))
        .route("/api/playlist/download", post(download_handler::start_playlist_download))
        .route("/api/stream/info", post(download_handler::get_stream_info))
        .route("/api/stream/download", post(download_handler::start_stream_download))
        .route("/api/search", post(download_handler::search_music))
        .route("/api/video/info", post(download_handler::get_video_info))
        .route("/api/downloads/batch", post(download_handler::start_batch_download))
        .route("/api/files", get(download_handler::list_files))
        .route("/api/files/stream", get(download_handler::stream_file))
        .route("/api/files/delete", post(download_handler::delete_file))
        .route("/api/files/rename", post(download_handler::rename_file))
        .route(
            "/api/settings",
            get(settings_handler::get_settings).put(settings_handler::update_settings),
        )
        .route("/api/version", get(update_handler::get_version))
        .route("/api/update/check", get(update_handler::check_update))
        .layer(cors)
        .with_state(config)
}
