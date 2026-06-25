import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import firebase_service
import calendar_service
import gemini_service

router = APIRouter(prefix="/focus", tags=["focus"])

# In-memory stores
_active_sessions: dict[str, dict] = {}
_session_history: dict[str, list[dict]] = {}  # user_email -> list of sessions


class FocusSession(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_email: str
    event_title: str
    start_time: datetime
    end_time: datetime
    focus_intensity: str
    blocked_sites: list[str]
    emergency_sites: list[str]
    is_active: bool = True
    ai_reason: str


class CheckRequest(BaseModel):
    user_email: str
    access_token: str
    user_settings: Optional[dict] = None


class EndSessionRequest(BaseModel):
    session_id: str


class OverrideRequest(BaseModel):
    session_id: str
    reason: str
    user_email: str


def _intensity_rank(intensity: str) -> int:
    return {"low": 0, "medium": 1, "high": 2}.get(intensity, 0)


def _push_history(email: str, session: dict) -> None:
    history = _session_history.setdefault(email, [])
    # Avoid duplicates
    history = [s for s in history if s["session_id"] != session["session_id"]]
    history.insert(0, session)
    _session_history[email] = history[:20]  # keep last 20


def check_and_activate(
    user_email: str,
    events: list[dict],
    analysis: list[dict],
    user_settings: dict,
) -> Optional[FocusSession]:
    now = datetime.now(timezone.utc)
    trigger_intensity = user_settings.get("trigger_intensity", "medium")
    advance_minutes = user_settings.get("advance_minutes", 15)

    for item in analysis:
        if not item.get("requires_focus"):
            continue
        if _intensity_rank(item.get("focus_intensity", "low")) < _intensity_rank(trigger_intensity):
            continue

        event = next((e for e in events if e["id"] == item["event_id"]), None)
        if not event:
            continue

        start_time = datetime.fromisoformat(event["start_time"])
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        end_time = datetime.fromisoformat(event["end_time"])
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)

        minutes_until = (start_time - now).total_seconds() / 60
        block_minutes = item.get("suggested_block_minutes", advance_minutes)

        if 0 <= minutes_until <= block_minutes:
            session = FocusSession(
                user_email=user_email,
                event_title=event["title"],
                start_time=start_time,
                end_time=end_time,
                focus_intensity=item.get("focus_intensity", "medium"),
                blocked_sites=user_settings.get("blocked_sites", []),
                emergency_sites=user_settings.get("emergency_sites", []),
                ai_reason=item.get("reason", ""),
            )
            return session

    return None


@router.post("/check")
async def check_focus(body: CheckRequest):
    settings = body.user_settings or firebase_service.get_user_settings(body.user_email)

    events = await calendar_service.fetch_upcoming_events(body.access_token)
    if not events:
        return {"session": None, "message": "No upcoming events in the next 24 hours"}

    analysis = await gemini_service.analyze_events(events)
    session = check_and_activate(body.user_email, events, analysis, settings)

    if session:
        session_dict = session.model_dump(mode="json")
        _active_sessions[body.user_email] = session_dict
        _push_history(body.user_email, session_dict)
        firebase_service.save_focus_session(session_dict)
        return {"session": session_dict}

    return {"session": None, "message": "No focus session needed right now"}


@router.get("/active/{user_email}")
async def get_active_session(user_email: str):
    session = _active_sessions.get(user_email)
    if not session:
        return {"is_active": False}

    end_time = datetime.fromisoformat(session["end_time"])
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > end_time:
        session["is_active"] = False
        _push_history(user_email, session)
        _active_sessions.pop(user_email, None)
        return {"is_active": False}

    return session


@router.get("/history/{user_email}")
async def get_session_history(user_email: str, limit: int = 10):
    # Prefer Firestore history if available; fall back to in-memory
    firestore_history = firebase_service.get_session_history(user_email, limit)
    if firestore_history:
        return {"history": firestore_history}
    memory_history = _session_history.get(user_email, [])[:limit]
    return {"history": memory_history}


@router.post("/end")
async def end_session(body: EndSessionRequest):
    for email, session in list(_active_sessions.items()):
        if session.get("session_id") == body.session_id:
            session["is_active"] = False
            _push_history(email, session)
            _active_sessions.pop(email, None)
            firebase_service.save_focus_session(session)
            return {"success": True}
    raise HTTPException(status_code=404, detail="Session not found")


@router.post("/override")
async def override_session(body: OverrideRequest):
    session = _active_sessions.get(body.user_email)
    if not session or session.get("session_id") != body.session_id:
        raise HTTPException(status_code=404, detail="Active session not found")

    override_record = {
        "session_id": body.session_id,
        "user_email": body.user_email,
        "reason": body.reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    firebase_service.log_override(override_record)
    return {"success": True, "message": "Override logged"}
