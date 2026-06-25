import os
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar.readonly",
]

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def _client_config() -> dict:
    return {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uris": [os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


def _build_flow() -> Flow:
    return Flow.from_client_config(
        _client_config(),
        scopes=SCOPES,
        redirect_uri=os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback"),
    )


@router.get("/login")
async def login():
    try:
        flow = _build_flow()
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        return RedirectResponse(url=auth_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth init failed: {str(e)}")


@router.get("/callback")
async def callback(code: str = None, error: str = None, state: str = None):
    if error:
        redirect_url = f"{FRONTEND_URL}/auth/callback?error={error}"
        return RedirectResponse(url=redirect_url)

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    try:
        flow = _build_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials

        import google.oauth2.id_token
        import google.auth.transport.requests

        request = google.auth.transport.requests.Request()
        id_info = google.oauth2.id_token.verify_oauth2_token(
            credentials.id_token, request, os.getenv("GOOGLE_CLIENT_ID")
        )

        params = urlencode(
            {
                "email": id_info.get("email", ""),
                "name": id_info.get("name", ""),
                "picture": id_info.get("picture", ""),
                "access_token": credentials.token or "",
                "refresh_token": credentials.refresh_token or "",
            }
        )
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?{params}")

    except Exception as e:
        redirect_url = f"{FRONTEND_URL}/auth/callback?error={str(e)}"
        return RedirectResponse(url=redirect_url)
