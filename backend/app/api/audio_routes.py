import os
import librosa
import soundfile as sf
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse
from web_backend.app.services import audio_service

router = APIRouter(prefix="/api/audio", tags=["Audio Utilities"])

@router.post("/antialias")
async def anti_alias(file: UploadFile = File(...)):
    """
    Reduce aliasing artifacts in an uploaded audio file.
    """
    try:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        y, sr = librosa.load(temp_path, sr=None)
        y_filtered = audio_service.apply_lowpass_filter(y, sr)

        output_path = f"filtered_{file.filename}"
        sf.write(output_path, y_filtered, sr)

        os.remove(temp_path)

        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="filtered.wav"
        )
    except Exception as e:
        return {"error": str(e)}