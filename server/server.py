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
    if len(filename) > 240:  # Windows a une limite de 260 caractères pour le chemin complet
        filename = filename[:240]
    
    return filename.strip()

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
        '-vcodec', 'h264',
        '-acodec', 'aac',
        '-strict', 'experimental'
    ],
    'extract_flat': True,  # Pour extraire les métadonnées sans télécharger
    'outtmpl': '%(title)s.%(ext)s',
    'nocheckcertificate': True,
    'quiet': False,  # Réactiver les logs
    'noprogress': False,  # Réactiver l'affichage de la progression
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
    },
    # Optimisations de performance
    'buffersize': 1024 * 1024,  # Buffer augmenté à 1MB
    'concurrent_fragments': 10,  # Plus de téléchargements simultanés
    'file_access_retries': 3,   # Moins de tentatives mais plus efficaces
    'fragment_retries': 3,      # Moins de tentatives pour les fragments
    'retry_sleep': 1,           # Temps d'attente réduit entre les tentatives
    'socket_timeout': 10,       # Timeout réduit mais suffisant
    'stream': True,             # Activation du streaming direct
    'throttledratelimit': None, # Suppression des limites de débit
    'verbose': True,            # Activer les logs détaillés
}

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

        print(f"\nDémarrage du téléchargement pour : {url}")
        
        with TemporaryDirectory() as temp_path:
            temp_path = Path(temp_path)
            temp_opts = ydl_opts.copy()
            temp_opts['outtmpl'] = str(temp_path / '%(title)s.%(ext)s')

            with yt_dlp.YoutubeDL(temp_opts) as ydl:
                try:
                    print("Extraction des informations de la vidéo...")
                    info = ydl.extract_info(url, download=True)
                    
                    if info:
                        # Nettoyer le nom du fichier
                        clean_title = sanitize_filename(info['title'])
                        
                        # Trouver le fichier téléchargé dans le dossier temporaire
                        temp_files = list(temp_path.glob('*.mp4'))
                        if not temp_files:
                            raise Exception("Aucun fichier MP4 trouvé après le téléchargement")
                        
                        temp_video_path = temp_files[0]
                        final_video_path = DOWNLOAD_FOLDER / f"{clean_title}.mp4"
                        
                        # S'assurer que le dossier de destination existe
                        DOWNLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
                        
                        # Copier le fichier vers le dossier permanent
                        shutil.copy2(str(temp_video_path), str(final_video_path))
                        print(f"Vidéo sauvegardée dans : {final_video_path}")
                        
                        # Envoyer le fichier depuis le dossier permanent
                        return send_file(
                            str(final_video_path),
                            mimetype='video/mp4',
                            as_attachment=True,
                            download_name=f"{clean_title}.mp4"
                        )
                    else:
                        print("Erreur : Impossible d'extraire les informations de la vidéo")
                        return jsonify({'error': 'Failed to extract video info'}), 500

                except Exception as e:
                    print(f"Erreur lors du téléchargement : {str(e)}")
                    return jsonify({'error': str(e)}), 500

    except Exception as e:
        print(f"Erreur générale : {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f"Démarrage du serveur de téléchargement...")
    print(f"Les vidéos seront sauvegardées dans : {DOWNLOAD_FOLDER}")
    app.run(host='0.0.0.0', port=5000, debug=True)