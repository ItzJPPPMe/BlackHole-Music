import re
from urllib.parse import urlparse

def is_valid_url(url: str) -> bool:
    if not url or not url.strip():
        return False
    try:
        result = urlparse(url)
        return result.scheme in ("http", "https")
    except Exception:
        return False

def sanitize_filename(name: str) -> str:
    clean = re.sub(r'[<>:"/\\|?*]', '_', name)
    clean = clean.strip()
    if len(clean) > 200:
        clean = clean[:200]
    return clean

def format_bytes(size: int) -> str:
    if size == 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size >= 1024 and i < len(units) - 1:
        size /= 1024
        i += 1
    return f"{size:.1f} {units[i]}"

def format_duration(seconds: int) -> str:
    if not seconds:
        return "00:00"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"
