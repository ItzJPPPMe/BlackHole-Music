import subprocess
import json

def get_video_info(url: str) -> dict:
    try:
        cmd = ["yt-dlp", "--dump-json", "--no-playlist", url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            return {"error": result.stderr.strip()}

        data = json.loads(result.stdout)
        return {
            "title": data.get("title", ""),
            "duration": data.get("duration", 0),
            "thumbnail": data.get("thumbnail", ""),
            "uploader": data.get("uploader", ""),
            "format": data.get("format", ""),
            "filesize": data.get("filesize", 0),
        }
    except subprocess.TimeoutExpired:
        return {"error": "İstek zaman aşımına uğradı"}
    except json.JSONDecodeError:
        return {"error": "JSON ayrıştırma hatası"}
    except FileNotFoundError:
        return {"error": "yt-dlp bulunamadı"}
    except Exception as e:
        return {"error": str(e)}

def get_formats(url: str) -> list:
    try:
        cmd = ["yt-dlp", "--dump-json", "--no-playlist", url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            return [{"error": result.stderr.strip()}]

        data = json.loads(result.stdout)
        formats = data.get("formats", [])

        cleaned = []
        for f in formats:
            cleaned.append({
                "format_id": f.get("format_id", ""),
                "ext": f.get("ext", ""),
                "resolution": f.get("resolution", ""),
                "fps": f.get("fps", 0),
                "filesize": f.get("filesize", 0),
            })

        return cleaned
    except Exception as e:
        return [{"error": str(e)}]

def get_playlist_info(url: str) -> dict:
    try:
        cmd = ["yt-dlp", "--dump-json", "--flat-playlist", "--no-download", url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

        if result.returncode != 0:
            return {"error": result.stderr.strip()}

        lines = result.stdout.strip().split("\n")
        tracks = []
        title = ""

        for i, line in enumerate(lines):
            try:
                item = json.loads(line)
                if i == 0:
                    title = item.get("title", "Bilinmeyen Playlist")
                tracks.append({
                    "index": i + 1,
                    "title": item.get("title", "Bilinmeyen"),
                    "url": item.get("url", ""),
                    "duration": item.get("duration_string", ""),
                    "uploader": item.get("uploader", ""),
                })
            except json.JSONDecodeError:
                continue

        return {
            "title": title,
            "url": url,
            "track_count": len(tracks),
            "tracks": tracks,
        }
    except subprocess.TimeoutExpired:
        return {"error": "Playlist bilgisi zaman aşımına uğradı"}
    except FileNotFoundError:
        return {"error": "yt-dlp bulunamadı"}
    except Exception as e:
        return {"error": str(e)}

def get_stream_info(url: str) -> dict:
    try:
        cmd = ["yt-dlp", "--dump-json", "--no-download", url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

        if result.returncode != 0:
            return {"error": result.stderr.strip()}

        data = json.loads(result.stdout)
        platform = detect_platform(url)

        return {
            "title": data.get("title", "Bilinmeyen Yayın"),
            "url": url,
            "platform": platform,
            "streamer": data.get("uploader", "Bilinmeyen"),
            "duration": data.get("duration_string", ""),
            "date": data.get("upload_date", ""),
            "thumbnail": data.get("thumbnail", ""),
        }
    except subprocess.TimeoutExpired:
        return {"error": "Yayın bilgisi zaman aşımına uğradı"}
    except FileNotFoundError:
        return {"error": "yt-dlp bulunamadı"}
    except Exception as e:
        return {"error": str(e)}

def detect_platform(url: str) -> str:
    if "youtube.com" in url or "youtu.be" in url:
        return "youtube"
    if "twitch.tv" in url:
        return "twitch"
    if "kick.com" in url:
        return "kick"
    return "other"
