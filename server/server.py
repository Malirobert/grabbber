from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
import re
import unicodedata

app = Flask(__name__)
CORS(app)

# Utilisation de pathlib pour créer un chemin multiplateforme
DOWNLOAD_FOLDER = Path.home() / "Videos" / "Downloads"
DOWNLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

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
    if len(filename) > 240:
        filename = filename[:240]
    
    return filename.strip()

# Configuration optimisée pour yt-dlp
ydl_opts = {
    'format': 'bestvideo[height<=480]+bestaudio/best[height<=480]',  # Format optimisé pour TikTok
    'merge_output_format': 'mp4',
    'postprocessors': [{
        'key': 'FFmpegVideoConvertor',
        'preferedformat': 'mp4'
    }],
    'extract_flat': True,
    'outtmpl': '/tmp/%(title)s.%(ext)s',
    'nocheckcertificate': True,
    'quiet': False,
    'noprogress': False,
    'http_headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-us,en;q=0.5',
        'Sec-Fetch-Mode': 'navigate'
    },
    'extractor_args': {
        'TikTok': {'format': 'h264'},  # Spécifique à TikTok
        'youtube': {'player_client': ['android'], 'formats': 'missing_pot'}
    },
    'buffersize': 1048576,
    'concurrent_fragments': 10,
    'file_access_retries': 5,
    'fragment_retries': 5,
    'retry_sleep': 5,
    'socket_timeout': 300,
    'stream': True,
    'throttledratelimit': None,
    'verbose': True,
    'max_filesize': 1073741824
}

@app.route('/download', methods=['POST'])
def download_video():
    try:
        url = request.json.get('url')
        if not url:
            return jsonify({'error': 'URL non fournie'}), 400

        print(f"Démarrage du téléchargement pour : {url}")
        print("Extraction des informations de la vidéo...")

        with TemporaryDirectory() as temp_dir:
            # Configurer le dossier de sortie temporaire
            ydl_opts['outtmpl'] = str(Path(temp_dir) / '%(title)s.%(ext)s')

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    # Extraire les informations de la vidéo
                    info = ydl.extract_info(url, download=True)
                    if not info:
                        return jsonify({'error': 'Impossible d\'extraire les informations de la vidéo'}), 500

                    # Obtenir le chemin du fichier téléchargé
                    filename = ydl.prepare_filename(info)
                    downloaded_file = Path(filename)

                    if not downloaded_file.exists():
                        return jsonify({'error': 'Fichier non trouvé après le téléchargement'}), 500

                    # Créer un nom de fichier sécurisé
                    safe_filename = sanitize_filename(downloaded_file.stem) + '.mp4'
                    output_path = DOWNLOAD_FOLDER / safe_filename

                    # Copier le fichier vers le dossier de destination
                    shutil.copy2(downloaded_file, output_path)

                    return jsonify({
                        'success': True,
                        'message': 'Vidéo téléchargée avec succès',
                        'filename': safe_filename,
                        'path': str(output_path)
                    })

            except Exception as e:
                print(f"Erreur lors du téléchargement : {str(e)}")
                return jsonify({'error': f'Erreur lors du téléchargement : {str(e)}'}), 500

    except Exception as e:
        print(f"Erreur générale : {str(e)}")
        return jsonify({'error': f'Erreur générale : {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000, timeout=300)
