from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
import re
import unicodedata
import logging

app = Flask(__name__)
CORS(app)

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Utilisation d'un chemin plus simple et fiable
DOWNLOAD_FOLDER = Path("/tmp/downloads")
DOWNLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

def sanitize_filename(filename):
    # Remplacer uniquement les caractères absolument interdits dans les systèmes de fichiers
    forbidden_chars = '<>:"\\/|?*'
    for char in forbidden_chars:
        filename = filename.replace(char, '-')
    return filename

# Configuration optimisée pour yt-dlp
ydl_opts = {
    'format': 'bestvideo[vcodec^=avc1][height<=1080]+bestaudio/best[vcodec^=avc1]/best',
    'merge_output_format': 'mp4',
    'postprocessors': [{
        'key': 'FFmpegVideoConvertor',
        'preferedformat': 'mp4',
    }],
    'prefer_ffmpeg': True,
    'postprocessor_args': [
        '-c:v', 'copy',  # Copier le flux vidéo sans réencodage
        '-c:a', 'aac',   # Convertir l'audio en AAC si nécessaire
        '-movflags', '+faststart',
    ],
    'outtmpl': str(DOWNLOAD_FOLDER / '%(title)s.%(ext)s'),  # Télécharger directement dans le dossier final
    'nocheckcertificate': True,
    'quiet': False,
    'verbose': True,
    'buffersize': 1024 * 1024 * 1024,  # 1GB buffer
    'socket_timeout': 600,
    'retries': 5,
    'http_headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    },
    'extractor_args': {
        'TikTok': {
            'format': 'h264'
        },
        'youtube': {
            'player_client': ['android'],
            'formats': 'missing_pot'
        }
    }
}

def copy_file_with_verification(source_path, dest_path):
    """Copie un fichier avec vérification de l'intégrité."""
    try:
        # Vérifier la taille du fichier source
        source_size = source_path.stat().st_size
        logger.info(f"Taille du fichier source : {source_size} bytes")

        # Copier le fichier avec vérification
        with open(source_path, 'rb') as src, open(dest_path, 'wb') as dst:
            shutil.copyfileobj(src, dst, length=1024*1024)  # Copie par blocs de 1MB

        # Vérifier la taille du fichier copié
        dest_size = dest_path.stat().st_size
        logger.info(f"Taille du fichier copié : {dest_size} bytes")

        # Vérifier que les tailles correspondent
        if source_size != dest_size:
            logger.error(f"Erreur de copie : tailles différentes (source: {source_size}, destination: {dest_size})")
            return False

        return True

    except Exception as e:
        logger.error(f"Erreur lors de la copie du fichier : {str(e)}")
        return False

def extract_video_id(url):
    # Gestion des différents formats d'URL YouTube
    if 'youtube.com/embed/' in url:
        return url.split('/')[-1].split('?')[0]
    elif 'youtube.com/watch?v=' in url:
        return url.split('watch?v=')[1].split('&')[0]
    elif 'youtu.be/' in url:
        return url.split('youtu.be/')[1].split('?')[0]
    return None

@app.route('/download', methods=['POST', 'OPTIONS'])
def download_video():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        url = data.get('url')
        if not url:
            return jsonify({'error': 'URL is required'}), 400

        logger.info(f"\nDémarrage du téléchargement pour : {url}")
        
        with TemporaryDirectory() as temp_path:
            temp_path = Path(temp_path)
            temp_opts = ydl_opts.copy()

            with yt_dlp.YoutubeDL(temp_opts) as ydl:
                try:
                    logger.info("Extraction des informations de la vidéo...")
                    info = ydl.extract_info(url, download=True)
                    
                    if info:
                        # Nettoyer le nom du fichier
                        clean_title = sanitize_filename(info['title'])
                        final_video_path = DOWNLOAD_FOLDER / f"{clean_title}.mp4"
                        
                        # Envoyer le fichier depuis le dossier permanent
                        return send_file(
                            str(final_video_path),
                            mimetype='video/mp4',
                            as_attachment=True,
                            download_name=f"{clean_title}.mp4"
                        )
                    else:
                        logger.error("Erreur : Impossible d'extraire les informations de la vidéo")
                        return jsonify({'error': 'Failed to extract video info'}), 500

                except Exception as e:
                    logger.error(f"Erreur lors du téléchargement : {str(e)}")
                    return jsonify({'error': str(e)}), 500

    except Exception as e:
        logger.error(f"Erreur générale : {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Démarrage du serveur de téléchargement...")
    logger.info(f"Les vidéos seront sauvegardées dans : {DOWNLOAD_FOLDER}")
    app.run(host='0.0.0.0', port=5000, debug=True)