use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;
use crate::{config::Config, handlers::download_handler};

pub fn create_router(config: Config) -> Router {
    let cors = CorsLayer::permissive();

    Router::new()
        .route("/api/download", post(download_handler::start_download))
        .route("/api/downloads", get(download_handler::get_downloads))
        .route("/api/downloads/:id", get(download_handler::get_download_by_id))
        .route("/api/playlist/info", post(download_handler::get_playlist_info))
        .route("/api/playlist/download", post(download_handler::start_playlist_download))
        .route("/api/stream/info", post(download_handler::get_stream_info))
        .route("/api/stream/download", post(download_handler::start_stream_download))
        .route("/api/search", post(download_handler::search_music))
        .route("/api/files", get(download_handler::list_files))
        .route("/api/files/delete", post(download_handler::delete_file))
        .layer(cors)
        .with_state(config)
}
