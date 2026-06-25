from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from auth import router as auth_router
from calendar_service import router as calendar_router
from gemini_service import router as gemini_router
from focus_engine import router as focus_router
from settings_router import router as settings_router

app = FastAPI(
    title="FocusGuard AI API",
    description="Backend API for FocusGuard AI productivity app",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "chrome-extension://",
    ],
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(calendar_router)
app.include_router(gemini_router)
app.include_router(focus_router)
app.include_router(settings_router)


@app.get("/")
async def root():
    return {"message": "FocusGuard AI API is running", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}
