from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import firebase_service

router = APIRouter(prefix="/settings", tags=["settings"])


class SaveSettingsRequest(BaseModel):
    user_email: str
    settings: dict


@router.post("/save")
async def save_settings(body: SaveSettingsRequest):
    success = firebase_service.save_user_settings(body.user_email, body.settings)
    return {"success": True, "persisted": success}


@router.get("/{user_email}")
async def get_settings(user_email: str):
    settings = firebase_service.get_user_settings(user_email)
    return {"settings": settings}
