use crate::errors::AppError;
use tokio::process::Command;

fn find_ytdlp() -> String {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();

    let local = exe_dir.join("yt-dlp.exe");
    if local.exists() {
        return local.to_string_lossy().to_string();
    }

    let parent = exe_dir.parent().and_then(|p| Some(p.join("yt-dlp.exe")));
    if let Some(p) = parent {
        if p.exists() {
            return p.to_string_lossy().to_string();
        }
    }

    "yt-dlp".to_string()
}

fn exec_dir() -> String {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string())
}

fn find_ffmpeg_dir() -> String {
    let dir = exec_dir();
    let candidates = [
        dir.clone(),
        format!("{}\\ffmpeg", dir),
        format!("{}\\..\\ffmpeg", dir),
    ];
    for c in candidates.iter() {
        if std::path::Path::new(&format!("{}\\ffmpeg.exe", c)).exists() {
            return c.clone();
        }
    }
    dir
}

pub struct DownloadService {
    ytdlp_path: String,
    ffmpeg_dir: String,
}

impl DownloadService {
    pub fn new() -> Self {
        Self {
            ytdlp_path: find_ytdlp(),
            ffmpeg_dir: find_ffmpeg_dir(),
        }
    }

    pub async fn start_download(
        &self,
        url: &str,
        quality: &str,
        format: &str,
        folder: &str,
    ) -> Result<String, AppError> {
        let args = self.build_single_args(url, quality, format, folder);
        self.run_ytdlp(args).await
    }

    pub async fn start_playlist_download(
        &self,
        url: &str,
        quality: &str,
        format: &str,
        folder: &str,
        album_structure: bool,
    ) -> Result<String, AppError> {
        let args = self.build_playlist_args(url, quality, format, folder, album_structure);
        self.run_ytdlp(args).await
    }

    pub async fn start_stream_download(
        &self,
        url: &str,
        quality: &str,
        format: &str,
        folder: &str,
    ) -> Result<String, AppError> {
        let platform = self.detect_platform(url);
        let args = self.build_stream_args(url, quality, format, folder, &platform);
        self.run_ytdlp(args).await
    }

    pub async fn get_playlist_info(&self, url: &str) -> Result<serde_json::Value, AppError> {
        let output = Command::new(&self.ytdlp_path)
            .args(&["--dump-json", "--flat-playlist", "--no-download", url])
            .output()
            .await;

        match output {
            Ok(out) => {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let lines: Vec<&str> = stdout.lines().collect();
                    let mut tracks = Vec::new();
                    let mut title = String::new();

                    for (i, line) in lines.iter().enumerate() {
                        if let Ok(item) = serde_json::from_str::<serde_json::Value>(line) {
                            if i == 0 {
                                title = item["title"]
                                    .as_str()
                                    .unwrap_or("Bilinmeyen Playlist")
                                    .to_string();
                            }
                            tracks.push(serde_json::json!({
                                "index": i + 1,
                                "title": item["title"].as_str().unwrap_or("Bilinmeyen"),
                                "url": item["url"].as_str().unwrap_or(""),
                                "duration": item["duration_string"].as_str().unwrap_or(""),
                                "uploader": item["uploader"].as_str().unwrap_or(""),
                            }));
                        }
                    }

                    Ok(serde_json::json!({
                        "title": title,
                        "url": url,
                        "track_count": tracks.len(),
                        "tracks": tracks,
                    }))
                } else {
                    let err_msg = String::from_utf8_lossy(&out.stderr).to_string();
                    Err(AppError::DownloadFailed(err_msg))
                }
            }
            Err(e) => Err(AppError::DownloadFailed(e.to_string())),
        }
    }

    pub async fn get_stream_info(&self, url: &str) -> Result<serde_json::Value, AppError> {
        let output = Command::new(&self.ytdlp_path)
            .args(&["--dump-json", "--no-download", url])
            .output()
            .await;

        match output {
            Ok(out) => {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&stdout) {
                        let platform = self.detect_platform(url);
                        Ok(serde_json::json!({
                            "title": data["title"].as_str().unwrap_or("Bilinmeyen Yayın"),
                            "url": url,
                            "platform": platform,
                            "streamer": data["uploader"].as_str().unwrap_or("Bilinmeyen"),
                            "duration": data["duration_string"].as_str().unwrap_or(""),
                            "date": data["upload_date"].as_str().unwrap_or(""),
                            "thumbnail": data["thumbnail"].as_str().unwrap_or(""),
                        }))
                    } else {
                        Err(AppError::DownloadFailed("JSON ayrıştırma hatası".to_string()))
                    }
                } else {
                    let err_msg = String::from_utf8_lossy(&out.stderr).to_string();
                    Err(AppError::DownloadFailed(err_msg))
                }
            }
            Err(e) => Err(AppError::DownloadFailed(e.to_string())),
        }
    }

    pub async fn search(&self, query: &str, limit: usize) -> Result<Vec<serde_json::Value>, AppError> {
        let mut results = Vec::new();
        let halved = (limit.max(2) / 2).max(2);

        let sources: Vec<(&str, &str)> = vec![
            ("ytsearch", "youtube"),
            ("scsearch", "soundcloud"),
            ("spsearch", "spotify"),
        ];

        for (prefix, platform) in sources {
            let search_query = format!("{}{}:{}", prefix, halved, query);
            let output = Command::new(&self.ytdlp_path)
                .args(&[
                    "--dump-json",
                    "--flat-playlist",
                    "--no-download",
                    "--no-warnings",
                    "--ignore-errors",
                    &search_query,
                ])
                .output()
                .await;

            if let Ok(out) = output {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    for line in stdout.lines() {
                        if let Ok(item) = serde_json::from_str::<serde_json::Value>(line) {
                            if let Some(parsed) = self.parse_search_result(&item, platform) {
                                results.push(parsed);
                            }
                        }
                    }
                }
            }
        }

        Ok(results)
    }

    fn parse_search_result(
        &self,
        item: &serde_json::Value,
        platform: &str,
    ) -> Option<serde_json::Value> {
        let title = item["title"].as_str().unwrap_or("").to_string();
        if title.is_empty() {
            return None;
        }

        let video_id = item["id"].as_str().unwrap_or("").to_string();
        let url = item["webpage_url"]
            .as_str()
            .or_else(|| item["url"].as_str())
            .unwrap_or("")
            .to_string();

        let display_url = if url.is_empty() {
            match platform {
                "youtube" => format!("https://www.youtube.com/watch?v={}", video_id),
                "soundcloud" => format!("https://soundcloud.com/search?q={}", video_id),
                "spotify" => format!("https://open.spotify.com/search/{}", video_id),
                _ => url,
            }
        } else {
            url
        };

        let mut thumbnail = item["thumbnail"].as_str().unwrap_or("").to_string();
        if thumbnail.is_empty() {
            if let Some(thumbs) = item["thumbnails"].as_array() {
                if let Some(t) = thumbs.iter().last() {
                    thumbnail = t["url"].as_str().unwrap_or("").to_string();
                }
            }
        }

        let duration = item["duration_string"].as_str().unwrap_or("").to_string();
        let dur = if duration.is_empty() {
            item["duration"].as_f64().map(|d| {
                let m = (d as u64) / 60;
                let s = (d as u64) % 60;
                format!("{}:{:02}", m, s)
            }).unwrap_or_default()
        } else {
            duration
        };

        let uploader = item["uploader"]
            .as_str()
            .or_else(|| item["channel"].as_str())
            .or_else(|| item["artist"].as_str())
            .unwrap_or("")
            .to_string();

        Some(serde_json::json!({
            "id": video_id,
            "title": title,
            "url": display_url,
            "thumbnail": thumbnail,
            "duration": dur,
            "uploader": uploader,
            "platform": platform,
        }))
    }

    fn detect_platform(&self, url: &str) -> String {
        if url.contains("youtube.com") || url.contains("youtu.be") {
            "youtube".to_string()
        } else if url.contains("twitch.tv") {
            "twitch".to_string()
        } else if url.contains("kick.com") {
            "kick".to_string()
        } else {
            "other".to_string()
        }
    }

    async fn run_ytdlp(&self, args: Vec<String>) -> Result<String, AppError> {
        let output = Command::new(&self.ytdlp_path)
            .args(&args)
            .output()
            .await;

        match output {
            Ok(out) => {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let lines: Vec<&str> = stdout.lines().filter(|l| !l.trim().is_empty()).collect();
                    let last = lines.last().map(|s| s.trim().to_string());

                    let title = last
                        .or_else(|| {
                            lines
                                .iter()
                                .find(|l| l.contains("[download] Destination:"))
                                .and_then(|l| l.split("Destination: ").nth(1))
                                .map(|s| s.trim().to_string())
                        })
                        .map(|s| {
                            std::path::Path::new(&s)
                                .file_name()
                                .map(|f| f.to_string_lossy().to_string())
                                .unwrap_or(s)
                        })
                        .unwrap_or_else(|| "Bilinmeyen içerik".to_string());

                    Ok(title)
                } else {
                    let err_msg = String::from_utf8_lossy(&out.stderr).to_string();
                    Err(AppError::DownloadFailed(err_msg))
                }
            }
            Err(e) => Err(AppError::DownloadFailed(e.to_string())),
        }
    }

    fn build_single_args(&self, url: &str, quality: &str, format: &str, folder: &str) -> Vec<String> {
        let mut args: Vec<String> = vec![
            "--ffmpeg-location".to_string(),
            self.ffmpeg_dir.clone(),
            "--no-playlist".to_string(),
            "--no-overwrites".to_string(),
        ];

        let fmt_arg = match quality {
            "1080" => "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "720" => "bestvideo[height<=720]+bestaudio/best[height<=720]",
            "480" => "bestvideo[height<=480]+bestaudio/best[height<=480]",
            _ => match format {
                "mp3" | "flac" | "wav" | "aac" | "ogg" => "bestaudio/best",
                "webm" => "bestvideo[ext=webm]+bestaudio/best",
                _ => "bestvideo+bestaudio/best",
            },
        };
        args.push("-f".to_string());
        args.push(fmt_arg.to_string());

        match format {
            "mp3" | "flac" | "wav" | "aac" | "ogg" => {
                args.push("--extract-audio".to_string());
                args.push("--audio-format".to_string());
                args.push(format.to_string());
                args.push("--embed-thumbnail".to_string());
                args.push("--add-metadata".to_string());
            }
            _ => {
                let out_fmt = if format.is_empty() { "mp4" } else { format };
                args.push("--merge-output-format".to_string());
                args.push(out_fmt.to_string());
                args.push("--recode-video".to_string());
                args.push(out_fmt.to_string());
            }
        }

        args.push("-o".to_string());
        args.push(format!("{}/%(title)s.%(ext)s", folder));
        args.push("--print".to_string());
        args.push("after_move:filepath".to_string());
        args.push(url.to_string());
        args
    }

    fn build_playlist_args(
        &self,
        url: &str,
        quality: &str,
        format: &str,
        folder: &str,
        album_structure: bool,
    ) -> Vec<String> {
        let mut args: Vec<String> = vec![
            "--ffmpeg-location".to_string(),
            self.ffmpeg_dir.clone(),
            "--yes-playlist".to_string(),
            "--no-overwrites".to_string(),
            "--ignore-errors".to_string(),
        ];

        let fmt_arg = match quality {
            "1080" => "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "720" => "bestvideo[height<=720]+bestaudio/best[height<=720]",
            "480" => "bestvideo[height<=480]+bestaudio/best[height<=480]",
            _ => match format {
                "mp3" | "flac" | "wav" | "aac" | "ogg" => "bestaudio/best",
                _ => "bestvideo+bestaudio/best",
            },
        };
        args.push("-f".to_string());
        args.push(fmt_arg.to_string());

        match format {
            "mp3" | "flac" | "wav" | "aac" | "ogg" => {
                args.push("--extract-audio".to_string());
                args.push("--audio-format".to_string());
                args.push(format.to_string());
                args.push("--embed-thumbnail".to_string());
                args.push("--add-metadata".to_string());
                args.push("--xattrs".to_string());

                if album_structure {
                    args.push("-o".to_string());
                    args.push(format!(
                        "{}/%(uploader)s/%(playlist_title)s/%(playlist_index)s - %(title)s.%(ext)s",
                        folder
                    ));
                } else {
                    args.push("-o".to_string());
                    args.push(format!("{}/%(title)s.%(ext)s", folder));
                }
            }
            _ => {
                args.push("--merge-output-format".to_string());
                args.push(if format.is_empty() { "mp4" } else { format }.to_string());
                args.push("--recode-video".to_string());
                args.push(if format.is_empty() { "mp4" } else { format }.to_string());
                args.push("-o".to_string());
                args.push(format!("{}/%(playlist_title)s/%(title)s.%(ext)s", folder));
            }
        }

        args.push("--print".to_string());
        args.push("after_move:filepath".to_string());
        args.push(url.to_string());
        args
    }

    fn build_stream_args(
        &self,
        url: &str,
        quality: &str,
        format: &str,
        folder: &str,
        platform: &str,
    ) -> Vec<String> {
        let mut args: Vec<String> = vec![
            "--ffmpeg-location".to_string(),
            self.ffmpeg_dir.clone(),
            "--no-overwrites".to_string(),
            "--no-playlist".to_string(),
            "--embed-thumbnail".to_string(),
            "--add-metadata".to_string(),
        ];

        if platform == "twitch" {
            args.push("--concurrent-fragments".to_string());
            args.push("4".to_string());
        }

        let fmt_arg = match quality {
            "1080" => "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "720" => "bestvideo[height<=720]+bestaudio/best[height<=720]",
            "480" => "bestvideo[height<=480]+bestaudio/best[height<=480]",
            "best" => "bestvideo+bestaudio/best",
            _ => "best",
        };
        args.push("-f".to_string());
        args.push(fmt_arg.to_string());

        match format {
            "mp3" | "flac" | "wav" | "aac" | "ogg" => {
                args.push("--extract-audio".to_string());
                args.push("--audio-format".to_string());
                args.push(format.to_string());
            }
            _ => {
                let out_fmt = if format.is_empty() { "mp4" } else { format };
                args.push("--merge-output-format".to_string());
                args.push(out_fmt.to_string());
                args.push("--recode-video".to_string());
                args.push(out_fmt.to_string());
            }
        }

        match platform {
            "youtube" => {
                args.push("-o".to_string());
                args.push(format!("{}/YouTube - %(title)s.%(ext)s", folder));
            }
            "twitch" => {
                args.push("-o".to_string());
                args.push(format!("{}/Twitch - %(uploader)s - %(title)s.%(ext)s", folder));
            }
            "kick" => {
                args.push("-o".to_string());
                args.push(format!("{}/Kick - %(uploader)s - %(title)s.%(ext)s", folder));
            }
            _ => {
                args.push("-o".to_string());
                args.push(format!("{}/%(title)s.%(ext)s", folder));
            }
        }

        args.push("--print".to_string());
        args.push("after_move:filepath".to_string());
        args.push(url.to_string());
        args
    }
}
