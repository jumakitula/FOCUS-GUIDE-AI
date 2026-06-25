import os
import json
import asyncio
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/ai", tags=["ai"])

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash:generateContent"
)

SYSTEM_PROMPT = (
    "You are a productivity AI assistant. Analyze the following calendar events "
    "and for each one return a JSON object with: event_id, requires_focus (boolean), "
    "focus_intensity (low/medium/high), reason (one sentence why), "
    "suggested_block_minutes (integer, how many minutes before the event focus mode "
    "should activate). Return ONLY a valid JSON array, no markdown, no explanation."
)


class AnalyzeRequest(BaseModel):
    events: list[dict]
    gemini_api_key: str | None = None


async def analyze_events(events: list[dict], api_key: str = None) -> list[dict]:
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": SYSTEM_PROMPT + "\n\n" + json.dumps(events, indent=2)}
                ],
            }
        ]
    }

    async def _post() -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                GEMINI_URL,
                params={"key": key},
                json=payload,
            )
            if resp.status_code == 429:
                return None
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return json.loads(text)

    try:
        result = await _post()
        if result is None:
            await asyncio.sleep(2)
            result = await _post()
        if result is None:
            raise HTTPException(status_code=429, detail="Gemini rate limited")
        return result
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Gemini returned invalid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")


@router.post("/analyze")
async def analyze(body: AnalyzeRequest):
    result = await analyze_events(body.events, body.gemini_api_key)
    return {"analysis": result}
