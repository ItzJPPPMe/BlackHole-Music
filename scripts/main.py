import sys
import json
from utils.video_info import get_video_info, get_formats, get_playlist_info, get_stream_info
from utils.helpers import is_valid_url, sanitize_filename

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Kullanımda: python main.py <komut> <args>"}))
        sys.exit(1)

    command = sys.argv[1]

    if command == "info":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "URL gerekli"}))
            sys.exit(1)
        url = sys.argv[2]
        result = get_video_info(url)
        print(json.dumps(result, ensure_ascii=False))

    elif command == "formats":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "URL gerekli"}))
            sys.exit(1)
        url = sys.argv[2]
        result = get_formats(url)
        print(json.dumps(result, ensure_ascii=False))

    elif command == "playlist-info":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "URL gerekli"}))
            sys.exit(1)
        url = sys.argv[2]
        result = get_playlist_info(url)
        print(json.dumps(result, ensure_ascii=False))

    elif command == "stream-info":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "URL gerekli"}))
            sys.exit(1)
        url = sys.argv[2]
        result = get_stream_info(url)
        print(json.dumps(result, ensure_ascii=False))

    elif command == "validate":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "URL gerekli"}))
            sys.exit(1)
        url = sys.argv[2]
        valid = is_valid_url(url)
        print(json.dumps({"valid": valid}))

    elif command == "sanitize":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Dosya adı gerekli"}))
            sys.exit(1)
        name = sys.argv[2]
        clean = sanitize_filename(name)
        print(json.dumps({"result": clean}))

    else:
        print(json.dumps({"error": f"Bilinmeyen komut: {command}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
