import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from scipy.signal import stft
from skimage.transform import resize
import mne
from web_backend.app.core import config

# --- Tabular EEG Service ---
def eeg_mse(y_true, y_pred):
    return tf.reduce_mean(tf.square(y_true - y_pred))

_EEG_MODEL = None

def get_tabular_eeg_model(custom_path: str = None):
    global _EEG_MODEL
    model_path = custom_path if custom_path else config.EEG_MODEL_PATH

    if _EEG_MODEL is None or custom_path:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"EEG model not found at {model_path}")

        _EEG_MODEL = load_model(
            model_path,
            custom_objects={"mse": eeg_mse},
            compile=False
        )
    return _EEG_MODEL

# --- EDF EEG Service ---
_EEG_EDF_MODEL = None

def get_edf_eeg_model():
    global _EEG_EDF_MODEL
    if _EEG_EDF_MODEL is None:
        _EEG_EDF_MODEL = tf.keras.models.load_model(config.EEG_EDF_MODEL_PATH)
    return _EEG_EDF_MODEL

def process_edf_file(file_path: str, sampling_rate: int):
    """
    Process EDF file to generate spectrograms for CNN.
    """
    raw = mne.io.read_raw_edf(file_path, preload=True, verbose=False)
    raw.rename_channels(lambda x: x.strip())
    raw.pick_types(eeg=True)

    sfreq_orig = int(raw.info["sfreq"])
    data = raw.get_data()

    if sampling_rate != sfreq_orig:
        raw.resample(sampling_rate)
        data = raw.get_data()
        sfreq = sampling_rate
    else:
        sfreq = sfreq_orig

    num_channels, num_samples = data.shape
    window_samples = int(2 * sfreq)
    window_data = data[:, :window_samples]

    channel_imgs = []
    for ch in range(min(3, num_channels)):
        f, t, Zxx = stft(window_data[ch], fs=sfreq, nperseg=window_samples // 2)
        Sxx = np.abs(Zxx)
        img_resized = resize(Sxx, (128, 128), mode="constant", anti_aliasing=True)
        channel_imgs.append(img_resized)

    rgb_img = np.stack(channel_imgs, axis=-1)
    x = np.expand_dims(rgb_img, axis=0).astype(np.float32)
    x = (x - np.min(x)) / (np.max(x) - np.min(x) + 1e-8)

    times = np.arange(num_samples) / sfreq
    return x, rgb_img, data, times