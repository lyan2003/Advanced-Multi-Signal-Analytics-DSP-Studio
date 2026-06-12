import numpy as np
import librosa
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences
from web_backend.app.core import config

_voice_model = None

def get_voice_model():
    global _voice_model
    if _voice_model is None:
        _voice_model = load_model(config.VOICE_MODEL_PATH)
    return _voice_model

def extract_voice_features(file_path: str) -> np.ndarray:
    """
    Extract Mel-Spectrogram features from an audio file.
    """
    y, sr = librosa.load(file_path, sr=None)
    y = y[: sr * 3]

    mel_spec = librosa.feature.melspectrogram(
        y=y, sr=sr, n_mels=128, n_fft=2048, hop_length=512
    )
    mel_db = librosa.power_to_db(mel_spec, ref=np.max).T

    mel_db = pad_sequences([mel_db], maxlen=94, padding="post", truncating="post")
    return np.array(mel_db, dtype=np.float32)