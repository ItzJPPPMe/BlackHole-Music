use std::env;

use crate::settings;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub download_dir: String,
    pub music_dir: String,
    pub theme: String,
}

fn app_data_dir() -> String {
    let base = env::var("APPDATA").unwrap_or_else(|_| {
        env::var("HOME").unwrap_or_else(|_| ".".to_string())
    });
    let dir = format!("{}\\VideoIndirici", base);
    if std::path::Path::new(&dir).exists() == false {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

impl Config {
    pub fn from_env() -> Self {
        let data_dir = app_data_dir();
        let current = settings::load();

        let default_download_dir = current.video_dir.clone();
        let _ = std::fs::create_dir_all(&default_download_dir);
        let _ = std::fs::create_dir_all(&current.music_dir);

        let download_dir = env::var("DOWNLOAD_DIR").unwrap_or_else(|_| {
            current.video_dir.clone()
        });

        let music_dir = env::var("MUSIC_DIR").unwrap_or_else(|_| {
            current.music_dir.clone()
        });

        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            format!("{}\\downloader.db", data_dir)
        });

        Self {
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .unwrap_or(3000),
            database_url,
            download_dir,
            music_dir,
            theme: current.theme,
        }
    }
}
