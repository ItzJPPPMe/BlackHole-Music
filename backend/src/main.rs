use ender_downloader_backend::{api, config::Config, db};
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().ok();
    let config = Config::from_env();

    let _pool = db::init_pool(&config.database_url).await?;

    let app = api::routes::create_router(config.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], config.port));
    tracing::info!("BlackHole Music Backend çalışıyor: http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
