use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;

pub async fn init_pool(database_path: &str) -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::from_str(database_path)
        .unwrap_or_else(|_| SqliteConnectOptions::new())
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            title TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            progress REAL NOT NULL DEFAULT 0.0,
            download_type TEXT DEFAULT 'video',
            download_path TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            title TEXT,
            track_count INTEGER DEFAULT 0,
            completed_tracks INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            format TEXT DEFAULT 'mp3',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}
