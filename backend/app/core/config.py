import os

# ==========================================
# Application Configuration
# ==========================================

# ECG Config
ECG_MODEL_PATH = os.getenv("MODEL_PATH", "web_backend/models/model.hdf5")
LABELS_PATH = os.getenv("LABELS_PATH", None)

# EEG Tabular Config
EEG_MODEL_PATH = os.getenv("EEG_MODEL_PATH", "web_backend/models/eeg_model.h5")

# EEG EDF Config
EEG_EDF_MODEL_PATH = os.getenv("EEG_EDF_MODEL_PATH", "web_backend/models/m32.h5")

# Voice Config
VOICE_MODEL_PATH = os.getenv("VOICE_MODEL_PATH", "web_backend/models/model_trained.h5")

# Drone Config
DRONE_MODEL_ID = os.getenv("DRONE_MODEL_ID", "preszzz/drone-audio-detection-05-17-trial-0")
DRONE_TARGET_SR = 16000