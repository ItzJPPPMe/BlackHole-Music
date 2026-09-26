use crate::errors::AppError;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

#[derive(Debug, Clone, Default)]
pub struct ProgressInfo {
    pub percent: f32,
    pub speed: String,
    pub eta: String,
}

static PROGRESS: OnceLock<Mutex<ProgressInfo>> = OnceLock::new();

fn progress_store() -> &'static Mutex<ProgressInfo> {
    PROGRESS.get_or_init(|| Mutex::new(ProgressInfo::default()))
}

fn set_progress(p: f32) {
    if let Ok(mut guard) = progress_store().lock() {
        guard.percent = p.clamp(0.0, 100.0);
    }
}

fn reset_progress() {
    if let Ok(mut guard) = progress_store().lock() {
        guard.percent = 0.0;
        guard.speed.clear();
        guard.eta.clear();
    }
}

fn set_speed_eta(speed: &str, eta: &str) {
    if let Ok(mut guard) = progress_store().lock() {
        if !speed.is_empty() {
            guard.speed = speed.to_string();
        }
        if !eta.is_empty() {
            guard.eta = eta.to_string();
        }
    }
}

pub fn get_progress() -> ProgressInfo {
    progress_store().lock().map(|g| g.clone()).unwrap_or_default()
}

static QUEUE: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

fn queue_lock() -> &'static tokio::sync::Mutex<()> {
    QUEUE.get_or_init(|| tokio::sync::Mutex::new(()))
}

static ACTIVE_CHILD: OnceLock<tokio::sync::Mutex<Option<Child>>> = OnceLock::new();

fn active_child_store() -> &'static tokio::sync::Mutex<Option<Child>> {
    ACTIVE_CHILD.get_or_init(|| tokio::sync::Mutex::new(None))
}

static CANCELLED: AtomicBool = AtomicBool::new(false);

async fn cleanup_partial_files() {
    let current = crate::settings::load();
    let dirs = vec![current.video_dir.clone(), current.music_dir.clone()];
    let mut seen: Vec<String> = Vec::new();
    for dir in dirs {
        let normalized = dir.to_lowercase();
        if seen.contains(&normalized) {
            continue;
        }
        seen.push(normalized);
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name() else { continue };
            let name = name.to_string_lossy().to_string();
            if name.ends_with(".part") || name.ends_with(".ytdl") {
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}

pub async fn cancel_download() -> bool {
    CANCELLED.store(true, Ordering::SeqCst);
    let cancelled = {
        let mut guard = active_child_store().lock().await;
        if let Some(child) = guard.as_mut() {
            let _ = child.kill().await;
            true
        } else {
            false
        }
    };
    reset_progress();
    cancelled
}

fn parse_progress(line: &str) -> Option<(f32, String, String)> {
    if !line.contains("% of") {
        return None;
    }
    let before = line.split("% of").next()?;
    let pct = before.rsplit(']').next()?.replace('%', "").trim().to_string();
    let pct: f32 = pct.parse().ok()?;

    let after = line.split("% of").nth(1).unwrap_or("");
    let mut speed = String::new();
    let mut eta = String::new();

    if let Some(at_idx) = after.find(" at ") {
        let rest = &after[at_idx + 4..];
        if let Some(sp) = rest.split_whitespace().next() {
            speed = sp.to_string();
        }
        if let Some(e) = after.find(" ETA ") {
            eta = after[e + 5..].split_whitespace().next().unwrap_or("").to_string();
        } else if let Some(i) = after.find(" in ") {
            eta = after[i + 4..].split_whitespace().next().unwrap_or("").to_string();
        }
    }

    Some((pct, speed, eta))
}

fn find_ytdlp() -> String {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();

    let local = exe_dir.join("yt-dlp.exe");
    if local.exists() {
        return local.to_string_lossy().to_string();
    }

    let parent = exe_dir.parent().map(|p| p.join("yt-dlp.exe"));
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

impl Default for DownloadService {
    fn default() -> Self {
        Self::new()
    }
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
        track_indices: Option<Vec<usize>>,
    ) -> Result<String, AppError> {
        let args =
            self.build_playlist_args(url, quality, format, folder, album_structure, track_indices);
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
            .args(["--dump-json", "--flat-playlist", "--no-download", url])
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
                            let track_url = item["webpage_url"]
                                .as_str()
                                .or_else(|| item["url"].as_str())
                                .unwrap_or("")
                                .to_string();
                            let track_url = if track_url.is_empty() {
                                item["id"].as_str().map(|id| format!("https://www.youtube.com/watch?v={}", id)).unwrap_or_default()
                            } else {
                                track_url
                            };
                            tracks.push(serde_json::json!({
                                "index": i + 1,
                                "title": item["title"].as_str().unwrap_or("Bilinmeyen"),
                                "url": track_url,
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
            .args(["--dump-json", "--no-download", url])
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

    pub async fn get_video_info(&self, url: &str) -> Result<serde_json::Value, AppError> {
        let output = Command::new(&self.ytdlp_path)
            .args(["--dump-json", "--no-download", "--no-playlist", url])
            .output()
            .await;

        match output {
            Ok(out) => {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&stdout) {
                        self.parse_video_info(&data)
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

    fn parse_video_info(&self, data: &serde_json::Value) -> Result<serde_json::Value, AppError> {
        let title = data["title"].as_str().unwrap_or("Bilinmeyen içerik").to_string();
        let uploader = data["uploader"]
            .as_str()
            .or_else(|| data["channel"].as_str())
            .or_else(|| data["artist"].as_str())
            .unwrap_or("")
            .to_string();

        let mut duration = data["duration_string"].as_str().unwrap_or("").to_string();
        if duration.is_empty() {
            duration = data["duration"]
                .as_f64()
                .map(|d| {
                    let m = (d as u64) / 60;
                    let s = (d as u64) % 60;
                    format!("{}:{:02}", m, s)
                })
                .unwrap_or_default();
        }

        let thumbnail = data["thumbnail"].as_str().unwrap_or("").to_string();

        let mut formats: Vec<serde_json::Value> = Vec::new();
        if let Some(list) = data["formats"].as_array() {
            for f in list.iter().take(12) {
                let height = f["height"].as_i64().unwrap_or(0);
                let ext = f["ext"].as_str().unwrap_or("").to_string();
                let vcodec = f["vcodec"].as_str().unwrap_or("none").to_string();
                let acodec = f["acodec"].as_str().unwrap_or("none").to_string();
                let tbr = f["tbr"].as_f64().unwrap_or(0.0);
                let is_audio = vcodec == "none";
                if ext.is_empty() {
                    continue;
                }
                formats.push(serde_json::json!({
                    "format_id": f["format_id"].as_str().unwrap_or(""),
                    "ext": ext,
                    "height": height,
                    "tbr": tbr,
                    "vcodec": vcodec,
                    "acodec": acodec,
                    "kind": if is_audio { "audio" } else { "video" },
                    "label": if is_audio {
                        format!("Ses ({})", ext)
                    } else {
                        format!("{}p {}", height, ext)
                    },
                }));
            }
        }
        formats.sort_by(|a, b| {
            let ah = a["height"].as_i64().unwrap_or(0);
            let bh = b["height"].as_i64().unwrap_or(0);
            bh.cmp(&ah)
        });
        formats.dedup_by(|a, b| a["label"] == b["label"]);

        Ok(serde_json::json!({
            "title": title,
            "url": data["webpage_url"].as_str().unwrap_or(""),
            "uploader": uploader,
            "duration": duration,
            "thumbnail": thumbnail,
            "view_count": data["view_count"].as_i64().unwrap_or(0),
            "like_count": data["like_count"].as_i64().unwrap_or(0),
            "upload_date": data["upload_date"].as_str().unwrap_or(""),
            "description": data["description"].as_str().unwrap_or("").chars().take(500).collect::<String>(),
            "formats": formats,
        }))
    }

    pub async fn search(&self, query: &str, limit: usize) -> Result<Vec<serde_json::Value>, AppError> {
        let mut results = Vec::new();
        let main = limit.max(20);
        let side = 10;

        let sources: Vec<(&str, &str, usize)> = vec![
            ("ytsearch", "youtube", main),
            ("scsearch", "soundcloud", side),
            ("spsearch", "spotify", side),
        ];

        let mut handles = Vec::new();
        for (prefix, platform, count) in sources {
            let search_query = format!("{}{}:{}", prefix, count, query);
            let ytdlp_path = self.ytdlp_path.clone();
            handles.push(tokio::spawn(async move {
                let output = Command::new(&ytdlp_path)
                    .args([
                        "--dump-json",
                        "--flat-playlist",
                        "--no-download",
                        "--no-warnings",
                        "--ignore-errors",
                        search_query.as_str(),
                    ])
                    .output()
                    .await;
                (platform, output)
            }));
        }

        for handle in handles {
            if let Ok((platform, Ok(out))) = handle.await {
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

    fn apply_common_opts(&self, args: &mut Vec<String>, format: &str) {
        let cfg = crate::settings::load();

        if !cfg.verify_ssl {
            args.push("--no-check-certificate".to_string());
        }

        let concurrent = if cfg.concurrent_fragments == 0 {
            8
        } else {
            cfg.concurrent_fragments
        };
        if let Some(pos) = args.iter().position(|a| a == "--concurrent-fragments") {
            args[pos + 1] = concurrent.to_string();
        }

        let is_audio = matches!(
            format,
            "mp3" | "flac" | "wav" | "aac" | "ogg"
        );

        if !cfg.rate_limit.trim().is_empty() {
            args.push("--limit-rate".to_string());
            args.push(cfg.rate_limit.trim().to_string());
        }

        if cfg.subtitles {
            args.push("--write-subs".to_string());
            args.push("--sub-langs".to_string());
            args.push(cfg.sub_langs.trim().to_string());
            args.push("--embed-subs".to_string());
        }

        if is_audio {
            if !cfg.embed_thumbnail {
                args.push("--no-embed-thumbnail".to_string());
            }
            if !cfg.add_metadata {
                args.push("--no-add-metadata".to_string());
            }
            let bitrate = cfg.audio_bitrate.trim();
            if !bitrate.is_empty() && bitrate != "0" {
                if let Some(pos) = args.iter().position(|a| a == "--audio-quality") {
                    args[pos + 1] = bitrate.to_string();
                } else {
                    args.push("--audio-quality".to_string());
                    args.push(bitrate.to_string());
                }
            }
        }

        if cfg.prefer_av1 && !is_audio {
            args.push("-S".to_string());
            args.push("codec:av01".to_string());
        }
    }

    async fn run_ytdlp(&self, args: Vec<String>) -> Result<String, AppError> {
        let _queue_guard = queue_lock().lock().await;

        reset_progress();
        CANCELLED.store(false, Ordering::SeqCst);

        let child = Command::new(&self.ytdlp_path)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AppError::DownloadFailed(format!("yt-dlp başlatılamadı: {}", e)))?;

        {
            let mut guard = active_child_store().lock().await;
            *guard = Some(child);
        }

        let stdout = {
            let child = {
                let mut guard = active_child_store().lock().await;
                guard.as_mut().unwrap().stdout.take()
            };
            child.ok_or_else(|| AppError::DownloadFailed("yt-dlp stdout alınamadı".to_string()))?
        };
        let stderr = {
            let child = {
                let mut guard = active_child_store().lock().await;
                guard.as_mut().unwrap().stderr.take()
            };
            child.ok_or_else(|| AppError::DownloadFailed("yt-dlp stderr alınamadı".to_string()))?
        };
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();

        let mut last = String::new();
        let mut err_lines: Vec<String> = Vec::new();
        let mut stdout_done = false;
        let mut stderr_done = false;

        while !(stdout_done && stderr_done) {
            tokio::select! {
                line = stdout_reader.next_line(), if !stdout_done => {
                    match line {
                        Ok(Some(l)) => {
                            if let Some((pct, speed, eta)) = parse_progress(&l) {
                                set_progress(pct);
                                set_speed_eta(&speed, &eta);
                            }
                            let t = l.trim().to_string();
                            if !t.is_empty() {
                                last = t.clone();
                            }
                        }
                        _ => stdout_done = true,
                    }
                }
                line = stderr_reader.next_line(), if !stderr_done => {
                    match line {
                        Ok(Some(l)) => {
                            let t = l.trim().to_string();
                            if !t.is_empty() {
                                err_lines.push(t);
                            }
                        }
                        _ => stderr_done = true,
                    }
                }
            }
        }

        let status = {
            let mut guard = active_child_store().lock().await;
            let child = guard.as_mut().ok_or_else(|| {
                AppError::DownloadFailed("yt-dlp process bulunamadı".to_string())
            })?;
            child.wait().await.map_err(|e| AppError::DownloadFailed(e.to_string()))?
        };

        {
            let mut guard = active_child_store().lock().await;
            *guard = None;
        }

        if status.success() {
            set_progress(100.0);

            let file_path = if last.trim().is_empty() {
                err_lines
                    .iter()
                    .find(|l| l.contains("[download] Destination:"))
                    .and_then(|l| l.split("Destination: ").nth(1))
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| "Bilinmeyen içerik".to_string())
            } else {
                last
            };

            Ok(file_path)
        } else {
            if CANCELLED.load(Ordering::SeqCst) {
                cleanup_partial_files().await;
                return Err(AppError::DownloadFailed("İndirme iptal edildi".to_string()));
            }
            let err_msg = err_lines.join("\n");
            if err_msg.trim().is_empty() {
                let code = status.code().unwrap_or(-1);
                return Err(AppError::DownloadFailed(format!("yt-dlp exit kodu: {}", code)));
            }
            Err(AppError::DownloadFailed(err_msg))
        }
    }

    fn build_single_args(&self, url: &str, quality: &str, format: &str, folder: &str) -> Vec<String> {
        let mut args: Vec<String> = vec![
            "--ffmpeg-location".to_string(),
            self.ffmpeg_dir.clone(),
            "--no-playlist".to_string(),
            "--no-overwrites".to_string(),
            "--newline".to_string(),
            "--concurrent-fragments".to_string(),
            "8".to_string(),
        ];

        let fmt_arg = match quality {
            "2160" => "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160]",
            "1440" => "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best[height<=1440]",
            "1080" => "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "720" => "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]",
            "480" => "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]",
            "360" => "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360]",
            _ => match format {
                "mp3" | "flac" | "wav" | "aac" | "ogg" => "bestaudio/best",
                "webm" => "bestvideo[ext=webm]+bestaudio/best",
                _ => "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
            },
        };
        args.push("-f".to_string());
        args.push(fmt_arg.to_string());

        match format {
            "mp3" | "flac" | "wav" | "aac" | "ogg" => {
                args.push("--extract-audio".to_string());
                args.push("--audio-format".to_string());
                args.push(format.to_string());
                args.push("--audio-quality".to_string());
                args.push("0".to_string());
                args.push("--embed-thumbnail".to_string());
                args.push("--add-metadata".to_string());
            }
            _ => {
                let out_fmt = if format.is_empty() { "mp4" } else { format };
                args.push("--merge-output-format".to_string());
                args.push(out_fmt.to_string());
                args.push("--remux-video".to_string());
                args.push(out_fmt.to_string());
            }
        }

        args.push("-o".to_string());
        args.push(format!("{}/%(title)s.%(ext)s", folder));
        args.push("--print".to_string());
        args.push("after_move:filepath".to_string());
        args.push(url.to_string());
        self.apply_common_opts(&mut args, format);
        args
    }

    fn build_playlist_args(
        &self,
        url: &str,
        quality: &str,
        format: &str,
        folder: &str,
        album_structure: bool,
        track_indices: Option<Vec<usize>>,
    ) -> Vec<String> {
        let mut args: Vec<String> = vec![
            "--ffmpeg-location".to_string(),
            self.ffmpeg_dir.clone(),
            "--yes-playlist".to_string(),
            "--no-overwrites".to_string(),
            "--ignore-errors".to_string(),
            "--newline".to_string(),
            "--concurrent-fragments".to_string(),
            "8".to_string(),
        ];

        let fmt_arg = match quality {
            "2160" => "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160]",
            "1440" => "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best[height<=1440]",
            "1080" => "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "720" => "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]",
            "480" => "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]",
            "360" => "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360]",
            _ => match format {
                "mp3" | "flac" | "wav" | "aac" | "ogg" => "bestaudio/best",
                _ => "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
            },
        };
        args.push("-f".to_string());
        args.push(fmt_arg.to_string());

        match format {
            "mp3" | "flac" | "wav" | "aac" | "ogg" => {
                args.push("--extract-audio".to_string());
                args.push("--audio-format".to_string());
                args.push(format.to_string());
                args.push("--audio-quality".to_string());
                args.push("0".to_string());
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
                args.push("--remux-video".to_string());
                args.push(if format.is_empty() { "mp4" } else { format }.to_string());
                args.push("-o".to_string());
                args.push(format!("{}/%(playlist_title)s/%(title)s.%(ext)s", folder));
            }
        }

        args.push("--print".to_string());
        args.push("after_move:filepath".to_string());

        if let Some(indices) = track_indices {
            if !indices.is_empty() {
                let items: Vec<String> = indices.iter().map(|i| i.to_string()).collect();
                args.push("--playlist-items".to_string());
                args.push(items.join(","));
            }
        }

        args.push(url.to_string());
        self.apply_common_opts(&mut args, format);
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
            "--newline".to_string(),
            "--concurrent-fragments".to_string(),
            "8".to_string(),
        ];

        let fmt_arg = match quality {
            "2160" => "bestvideo[height<=2160]+bestaudio/best[height<=2160]",
            "1440" => "bestvideo[height<=1440]+bestaudio/best[height<=1440]",
            "1080" => "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "720" => "bestvideo[height<=720]+bestaudio/best[height<=720]",
            "480" => "bestvideo[height<=480]+bestaudio/best[height<=480]",
            "360" => "bestvideo[height<=360]+bestaudio/best[height<=360]",
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
                args.push("--audio-quality".to_string());
                args.push("0".to_string());
            }
            _ => {
                let out_fmt = if format.is_empty() { "mp4" } else { format };
                args.push("--merge-output-format".to_string());
                args.push(out_fmt.to_string());
                args.push("--remux-video".to_string());
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
        self.apply_common_opts(&mut args, format);
        args
    }
}
