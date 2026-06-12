import os
import json
import numpy as np
import pandas as pd
from typing import List, Optional
from tensorflow.keras.models import load_model
from tensorflow.keras.optimizers import Adam
from web_backend.app.core import config

_model = None
_ecg_labels: Optional[List[str]] = None


def get_ecg_model(custom_path: str = None):
    """
    Load the ECG model once and reuse it.
    """
    global _model

    model_path = custom_path if custom_path else config.ECG_MODEL_PATH

    if _model is None or custom_path:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"ECG model file not found: {model_path}")

        m = load_model(model_path, compile=False)
        try:
            m.compile(loss="binary_crossentropy", optimizer=Adam())
        except Exception:
            pass
        _model = m

    return _model


def try_load_labels() -> Optional[List[str]]:
    """
    Attempt to load class labels.
    """
    paths = []
    if config.LABELS_PATH:
        paths.append(config.LABELS_PATH)
    paths += ["models/labels.txt", "models/labels.json"]

    for path in paths:
        if not path or not os.path.exists(path):
            continue
        try:
            if path.lower().endswith(".txt"):
                with open(path, "r", encoding="utf-8") as f:
                    labels = [ln.strip() for ln in f if ln.strip()]
                return labels or None
            else:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict) and isinstance(data.get("labels"), list):
                    return [str(x) for x in data["labels"]]
                if isinstance(data, list):
                    return [str(x) for x in data]
        except Exception:
            continue
    return None


def get_ecg_labels():
    global _ecg_labels
    if _ecg_labels is None:
        _ecg_labels = try_load_labels()
    return _ecg_labels


def df_to_ecg_array(df: pd.DataFrame, target_len: int = 4096) -> np.ndarray:
    """
    Convert a CSV DataFrame into the format expected by the ECG model.
    """
    lead_sets = [
        [f"Lead_{i}" for i in range(1, 13)],
        ["ECG I", "ECG II", "ECG III", "ECG aVR", "ECG aVL", "ECG aVF", "ECG V1", "ECG V2", "ECG V3", "ECG V4",
         "ECG V5", "ECG V6"],
        ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"],
    ]

    cols = list(df.columns)
    chosen = None

    for cand in lead_sets:
        if all(name in cols for name in cand):
            chosen = cand
            break

    if chosen is None:
        if len(cols) <= 1:
            raise ValueError("CSV must contain at least a time column and one signal column.")
        take = min(12, len(cols) - 1)
        data = [df.iloc[:, c].to_numpy(dtype=float, copy=False) for c in range(1, 1 + take)]
    else:
        data = [df[name].to_numpy(dtype=float, copy=False) for name in chosen]

    signals: List[np.ndarray] = []

    for sig in data:
        if len(sig) < target_len:
            sig = np.pad(sig, (0, target_len - len(sig)))
        else:
            sig = sig[:target_len]

        signals.append(sig)

    if len(signals) < 12:
        for _ in range(12 - len(signals)):
            signals.append(np.zeros(target_len, dtype=float))
    elif len(signals) > 12:
        signals = signals[:12]

    ecg = np.stack(signals, axis=-1)
    ecg = np.expand_dims(ecg, axis=0)

    return ecg