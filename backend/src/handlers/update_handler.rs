use axum::{Json, response::IntoResponse};
use crate::errors::AppError;
use crate::models::response::ApiResponse;

pub const APP_VERSION: &str = "1.3.0";
pub const REPO_URL: &str = "https://github.com/ItzJPPPMe/BlackHole-Music";

pub async fn get_version() -> Result<impl IntoResponse, AppError> {
    let response = ApiResponse::success(
        serde_json::json!({
            "version": APP_VERSION,
            "repo_url": REPO_URL,
        }),
        "Sürüm bilgisi",
    );
    Ok(Json(response))
}

pub async fn check_update() -> Result<impl IntoResponse, AppError> {
    let latest = fetch_latest_version().await;
    let update_available = latest
        .as_deref()
        .map(|v| v.trim_start_matches('v') != APP_VERSION)
        .unwrap_or(false);

    let response = ApiResponse::success(
        serde_json::json!({
            "current": APP_VERSION,
            "latest": latest.unwrap_or_else(|| APP_VERSION.to_string()),
            "update_available": update_available,
            "repo_url": REPO_URL,
        }),
        "Güncelleme kontrolü",
    );
    Ok(Json(response))
}

async fn fetch_latest_version() -> Option<String> {
    let url = format!("{}/releases/latest", REPO_URL);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .user_agent("BlackHole-Music/1.3.0")
        .build()
        .ok()?;
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let json: serde_json::Value = resp.json().await.ok()?;
    json["tag_name"].as_str().map(|s| s.to_string())
}