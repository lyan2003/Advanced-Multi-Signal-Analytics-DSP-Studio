from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import all routers
from web_backend.app.api import ecg_routes, eeg_routes, voice_routes, audio_routes, drone_routes

import os
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

# Initialize FastAPI application
app = FastAPI(title="Signal Viewer Backend", version="1.2")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(ecg_routes.router)
app.include_router(eeg_routes.router)
app.include_router(voice_routes.router)
app.include_router(audio_routes.router)
app.include_router(drone_routes.router)

@app.get("/api/health", tags=["System Check"])
def health():
    """
    Health check endpoint to ensure API is running.
    """
    return {"status": "ok"}