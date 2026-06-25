import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DEFAULT_SETTINGS = {
    "blocked_sites": [
        "instagram.com",
        "twitter.com",
        "youtube.com",
        "reddit.com",
        "tiktok.com",
        "facebook.com",
    ],
    "emergency_sites": ["gmail.com", "meet.google.com", "whatsapp.com"],
    "trigger_intensity": "medium",
    "advance_minutes": 15,
}

_db = None


def _get_db():
    global _db
    if _db is not None:
        return _db

    path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if not path:
        logger.warning("FIREBASE_SERVICE_ACCOUNT_PATH not set — Firestore disabled")
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred = credentials.Certificate(path)
            firebase_admin.initialize_app(cred)

        _db = firestore.client()
        return _db
    except Exception as e:
        logger.error(f"Firebase init failed: {e}")
        return None


def save_user_settings(user_email: str, settings_dict: dict) -> bool:
    db = _get_db()
    if db is None:
        return False
    try:
        db.collection("users").document(user_email).set(
            {"settings": settings_dict}, merge=True
        )
        return True
    except Exception as e:
        logger.error(f"save_user_settings error: {e}")
        return False


def get_user_settings(user_email: str) -> dict:
    db = _get_db()
    if db is None:
        return DEFAULT_SETTINGS.copy()
    try:
        doc = db.collection("users").document(user_email).get()
        if doc.exists:
            return doc.to_dict().get("settings", DEFAULT_SETTINGS.copy())
        return DEFAULT_SETTINGS.copy()
    except Exception as e:
        logger.error(f"get_user_settings error: {e}")
        return DEFAULT_SETTINGS.copy()


def save_focus_session(session_dict: dict) -> bool:
    db = _get_db()
    if db is None:
        return False
    try:
        db.collection("sessions").document(session_dict["session_id"]).set(session_dict)
        return True
    except Exception as e:
        logger.error(f"save_focus_session error: {e}")
        return False


def get_session_history(user_email: str, limit: int = 10) -> list[dict]:
    db = _get_db()
    if db is None:
        return []
    try:
        docs = (
            db.collection("sessions")
            .where("user_email", "==", user_email)
            .order_by("start_time", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        logger.error(f"get_session_history error: {e}")
        return []


def log_override(override_dict: dict) -> bool:
    db = _get_db()
    if db is None:
        return False
    try:
        db.collection("overrides").add(override_dict)
        return True
    except Exception as e:
        logger.error(f"log_override error: {e}")
        return False
