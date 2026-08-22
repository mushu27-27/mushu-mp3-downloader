import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlparse

import yt_dlp
import imageio_ffmpeg

ROOT = Path(__file__).parent
DOWNLOADS = Path.home() / "Downloads" / "Signal Converter"
ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}


def is_youtube_url(value):
    parsed = urlparse(value)
    return parsed.scheme == "https" and parsed.hostname in ALLOWED_HOSTS


class AppHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/download":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            url = payload.get("url", "").strip()
            if not is_youtube_url(url):
                raise ValueError("Enlace de YouTube no válido.")

            DOWNLOADS.mkdir(parents=True, exist_ok=True)
            options = {
                "format": "bestaudio/best",
                "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
                "outtmpl": str(DOWNLOADS / "%(title)s.%(ext)s"),
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }],
            }
            with yt_dlp.YoutubeDL(options) as downloader:
                info = downloader.extract_info(url, download=False)
                prepared_filename = Path(downloader.prepare_filename(info))
                downloader.download([url])
                filename = prepared_filename.with_suffix(".mp3")

            self.send_file(filename)
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def send_file(self, filename):
        if not filename.exists():
            self.send_json(500, {"error": "No se encontró el archivo descargado."})
            return
        data = filename.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(data)))
        encoded_name = quote(filename.name)
        self.send_header(
            "Content-Disposition",
            f'attachment; filename="{filename.name}"; filename*=UTF-8\'\'{encoded_name}'
        )
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        if self.path.startswith("/api/"):
            super().log_message(format, *args)


if __name__ == "__main__":
    os.chdir(ROOT)
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), AppHandler)
    print(f"Mushu mp3 Downloader disponible en el puerto {port}")
    server.serve_forever()
