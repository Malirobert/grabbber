from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
from tempfile import TemporaryDirectory
import shutil

app = Flask(__name__)
CORS(app)

# Créer un dossier permanent pour les téléchargements
DOWNLOAD_FOLDER = os.path.join("C:\\", "Videos")  # Dossier Videos à la racine du disque C
if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)

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
            temp_opts = ydl_opts.copy()
            temp_opts['outtmpl'] = os.path.join(temp_path, '%(title)s.%(ext)s')

            with yt_dlp.YoutubeDL(temp_opts) as ydl:
                try:
                    print("Extraction des informations de la vidéo...")
                    info = ydl.extract_info(url, download=True)
                    
                    if info:
                        temp_video_path = os.path.join(temp_path, f"{info['title']}.{info['ext']}")
                        final_video_path = os.path.join(DOWNLOAD_FOLDER, f"{info['title']}.{info['ext']}")
                        
                        # Copier le fichier vers le dossier permanent
                        shutil.copy2(temp_video_path, final_video_path)
                        print(f"Vidéo sauvegardée dans : {final_video_path}")
                        
                        # Envoyer le fichier depuis le dossier permanent
                        return send_file(
                            final_video_path,
                            as_attachment=True,
                            download_name=f"{info['title']}.{info['ext']}",
                            mimetype='video/mp4'
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