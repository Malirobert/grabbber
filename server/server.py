import os
import tempfile
import shutil
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import yt_dlp
import logging
from werkzeug.utils import secure_filename
import re
import unicodedata

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Augmenter le timeout de Flask
app.config['TIMEOUT'] = 300

# Utilisation de pathlib pour créer un chemin multiplateforme
DOWNLOAD_FOLDER = os.path.join(os.path.expanduser("~"), "Videos", "Downloads")
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

def sanitize_filename(filename):
    # Supprimer les emojis et autres caractères spéciaux
    filename = ''.join(char for char in filename if unicodedata.category(char)[0] != 'So')
    
    # Supprimer ou remplacer les caractères non-ASCII
    filename = unicodedata.normalize('NFKD', filename).encode('ASCII', 'ignore').decode('ASCII')
    
    # Remplacer les caractères interdits par des tirets
    filename = re.sub(r'[<>:"/\\|?*]', '-', filename)
    
    # Remplacer les espaces multiples par un seul espace
    filename = re.sub(r'\s+', ' ', filename)
    
    # Limiter la longueur du nom de fichier
    if len(filename) > 240:  # Windows a une limite de 260 caractères pour le chemin complet
        filename = filename[:240]
    
    return filename.strip()

def cleanup_temp_files(temp_dir):
    try:
        shutil.rmtree(temp_dir)
    except Exception as e:
        logger.error(f"Error cleaning up temp directory: {e}")

@app.route('/download', methods=['POST'])
def download_video():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 400

    data = request.get_json()
    url = data.get('url')
    
    if not url:
        return jsonify({"error": "URL is required"}), 400

    # Créer un dossier temporaire unique
    temp_dir = tempfile.mkdtemp()
    try:
        ydl_opts = {
            # Réduire la qualité vidéo pour économiser la mémoire
            'format': 'bestvideo[height<=480][vcodec^=avc1]+bestaudio/best[height<=480]/best',
            'merge_output_format': 'mp4',
            'prefer_ffmpeg': True,
            'extract_flat': True,
            'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
            'nocheckcertificate': True,
            'quiet': False,
            'noprogress': False,
            
            # Optimisations pour Render freemium
            'buffersize': 512 * 1024,  # 512KB buffer
            'concurrent_fragments': 5,
            'file_access_retries': 3,
            'fragment_retries': 3,
            'retry_sleep': 0.5,
            'socket_timeout': 30,
            'stream': True,
            'throttledratelimit': 1024 * 1024,  # ~1MB/s
            
            # Limite de taille pour éviter les timeouts
            'max_filesize': 400 * 1024 * 1024,  # 400MB max
            
            # Headers renforcés pour l'authentification
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document',
                'Upgrade-Insecure-Requests': '1',
                'Connection': 'keep-alive'
            },
            
            # Configurations spécifiques par site
            'extractor_args': {
                'TikTok': {'format': 'h264'},
                'youtube': {'player_client': ['android']},
                'Instagram': {'compatible_format': True},
                'Pornhub': {'download_timeout': 30},
                'XVideos': {'download_timeout': 30}
            },
            
            # Post-processeurs avec la configuration correcte
            'postprocessors': [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4',
                # Utiliser les options FFmpeg directement
                'ffmpeg_args': ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k']
            }],
            'verbose': True
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                logger.info(f"Extracting URL: {url}")
                print(f"Démarrage du téléchargement pour : {url}")
                print("Extraction des informations de la vidéo...")
                
                info = ydl.extract_info(url, download=True)
                
                if info is None:
                    raise Exception("Failed to extract video information")

                video_title = info.get('title', 'video')
                video_path = None

                # Rechercher le fichier MP4 dans le dossier temporaire
                for file in os.listdir(temp_dir):
                    if file.endswith('.mp4'):
                        video_path = os.path.join(temp_dir, file)
                        break

                if not video_path or not os.path.exists(video_path):
                    raise Exception("Video file not found after download")

                response = send_file(
                    video_path,
                    mimetype='video/mp4',
                    as_attachment=True,
                    download_name=f"{secure_filename(video_title)}.mp4"
                )
                
                # Nettoyer après l'envoi
                @response.call_on_close
                def cleanup():
                    cleanup_temp_files(temp_dir)

                return response

            except Exception as e:
                logger.error(f"Error downloading video: {e}")
                cleanup_temp_files(temp_dir)
                return jsonify({"error": str(e)}), 500
                
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        cleanup_temp_files(temp_dir)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
