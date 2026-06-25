from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import google.oauth2.credentials

router = APIRouter(prefix="/calendar", tags=["calendar"])


class TokenRequest(BaseModel):
    access_token: str


def _calendar_service(access_token: str):
    credentials = google.oauth2.credentials.Credentials(token=access_token)
    return build("calendar", "v3", credentials=credentials)


async def fetch_upcoming_events(access_token: str) -> list[dict]:
    try:
        service = _calendar_service(access_token)
        now = datetime.now(timezone.utc)
        time_max = now + timedelta(hours=24)

        result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=now.isoformat(),
                timeMax=time_max.isoformat(),
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

        events = []
        for item in result.get("items", []):
            start = item.get("start", {})
            end = item.get("end", {})
            attendees = item.get("attendees", [])
            events.append(
                {
                    "id": item.get("id"),
                    "title": item.get("summary", "Untitled Event"),
                    "start_time": start.get("dateTime") or start.get("date"),
                    "end_time": end.get("dateTime") or end.get("date"),
                    "description": item.get("description", ""),
                    "attendees_count": len(attendees),
                }
            )
        return events

    except HttpError as e:
        if e.resp.status == 401:
            raise HTTPException(status_code=401, detail="token_expired")
        raise HTTPException(status_code=500, detail=f"Calendar API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/events")
async def get_events(body: TokenRequest):
    events = await fetch_upcoming_events(body.access_token)
    return {"events": events}
