use serde::{Deserialize, Serialize};
use std::env;
use std::path::Path;

fn default_quality() -> String {
    "best".to_string()
}

fn default_bitrate() -> String {
    "0".to_string()
}

fn default_sub_langs() -> String {
    "tr,en,en.*".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    #[serde(default)]
    pub video_dir: String,
    #[serde(default)]
    pub music_dir: String,
    #[serde(default)]
    pub theme: String,
    #[serde(default = "default_quality")]
    pub video_quality: String,
    #[serde(default = "default_dark")]
    pub dark_mode: bool,
    #[serde(default)]
    pub rate_limit: String,
    #[serde(default = "default_bitrate")]
    pub audio_bitrate: String,
    #[serde(default)]
    pub subtitles: bool,
    #[serde(default = "default_sub_langs")]
    pub sub_langs: String,
    #[serde(default)]
    pub embed_thumbnail: bool,
    #[serde(default)]
    pub add_metadata: bool,
    #[serde(default = "default_concurrent")]
    pub concurrent_fragments: u32,
    #[serde(default)]
    pub verify_ssl: bool,
    #[serde(default)]
    pub prefer_av1: bool,
}

fn default_concurrent() -> u32 {
    8
}

fn default_dark() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            video_dir: "C:\\Video_Indirici".to_string(),
            music_dir: "C:\\Video_Indirici".to_string(),
            theme: "blue".to_string(),
            video_quality: "best".to_string(),
            dark_mode: true,
            rate_limit: String::new(),
            audio_bitrate: "0".to_string(),
            subtitles: false,
            sub_langs: "tr,en,en.*".to_string(),
            embed_thumbnail: true,
            add_metadata: true,
            concurrent_fragments: 8,
            verify_ssl: true,
            prefer_av1: false,
        }
    }
}

fn app_data_dir() -> String {
    let base = env::var("APPDATA").unwrap_or_else(|_| {
        env::var("HOME").unwrap_or_else(|_| ".".to_string())
    });
    let dir = format!("{}\\VideoIndirici", base);
    if !Path::new(&dir).exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

pub fn settings_path() -> String {
    format!("{}\\settings.json", app_data_dir())
}

pub fn load() -> Settings {
    let path = settings_path();
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(settings) = serde_json::from_str::<Settings>(&content) {
            return settings;
        }
    }
    Settings::default()
}

pub fn save(settings: &Settings) -> std::io::Result<()> {
    let path = settings_path();
    let content = serde_json::to_string_pretty(settings)?;
    std::fs::write(path, content)
}