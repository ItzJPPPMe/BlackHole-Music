use serde::{Deserialize, Serialize};
use std::env;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub video_dir: String,
    pub music_dir: String,
    pub theme: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            video_dir: "C:\\Video_Indirici".to_string(),
            music_dir: "C:\\Video_Indirici".to_string(),
            theme: "blue".to_string(),
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