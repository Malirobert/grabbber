import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta, timezone
import random
import string
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

# Configuration Firebase
def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate('c:\\Users\\Robii\\Music\\secure_keys\\serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    return firestore.client()

def generate_premium_code():
    """Génère un code premium unique"""
    def generate_part():
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"GRAB-{generate_part()}-{generate_part()}-{generate_part()}"

def create_premium_code(db):
    code = generate_premium_code()
    
    code_data = {
        'code': code,
        'type': 'monthly',
        'createdAt': SERVER_TIMESTAMP,
        'expiresAt': datetime.now(timezone.utc) + timedelta(days=60),
        'usedAt': None,
        'usedBy': None,
        'active': True
    }
    
    try:
        db.collection('premium_codes').document(code).set(code_data)
        return code, None
    except Exception as e:
        return None, str(e)

def main():
    print("Initialisation de la connexion à Firebase...")
    try:
        db = init_firebase()
        # Test de connexion immédiat
        db.collection('test_connection').document('ping').set({'timestamp': datetime.now(timezone.utc)})
    except Exception as e:
        print(f"\n❌ Erreur d'initialisation Firebase: {str(e)}")
        print("Vérifiez que :")
        print("1. La base Firestore existe bien dans la console Firebase")
        print("2. Votre VPN est actif et stable")
        print("3. Les règles de sécurité permettent l'écriture")
        return
    
    print("Génération d'un nouveau code premium...")
    code, error = create_premium_code(db)
    
    if error:
        print(f"\n❌ Erreur: {error}")
        return
    
    print(f"""
✅ Code premium généré avec succès !

   Code: {code}

   ⚠️ Informations importantes:
   ===========================
   • Valable pour 30 jours d'accès premium
   • Doit être activé dans les 60 jours
   • Usage unique uniquement
   • Ne pas partager
   ===========================
""")

if __name__ == "__main__":
    main()