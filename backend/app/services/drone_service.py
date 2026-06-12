import io
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample
from transformers import pipeline
from web_backend.app.core import config

_drone_clf = None

def get_drone_classifier():
    global _drone_clf
    if _drone_clf is None:
        try:
            _drone_clf = pipeline(
                task="audio-classification",
                model=config.DRONE_MODEL_ID,
                device=-1
            )
        except Exception as e:
            print(f"Drone audio detection model could not be loaded: {e}")
    return _drone_clf

def preprocess_drone_audio(file_bytes: bytes) -> np.ndarray:
    """
    Preprocess an uploaded WAV audio file before inference.
    """
    try:
        sr, data = wavfile.read(io.BytesIO(file_bytes))
    except Exception as exc:
        raise ValueError(f"Failed to read WAV file: {exc}")

    if data.ndim > 1:
        data = data.mean(axis=1)

    if np.issubdtype(data.dtype, np.integer):
        info = np.iinfo(data.dtype)
        data = data.astype(np.float32) / max(abs(info.min), info.max)
    else:
        data = data.astype(np.float32)

    if sr != config.DRONE_TARGET_SR:
        num_out = int(len(data) * config.DRONE_TARGET_SR / sr)
        data = resample(data, num_out).astype(np.float32)

    return np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)