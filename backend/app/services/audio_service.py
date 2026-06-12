from scipy.signal import butter, filtfilt


def apply_lowpass_filter(signal, sr, cutoff=4000):
    """
    Apply a Butterworth low-pass filter to reduce aliasing effects.
    """
    nyquist = 0.5 * sr
    normal_cutoff = cutoff / nyquist
    b, a = butter(5, normal_cutoff, btype="low", analog=False)

    filtered_signal = filtfilt(b, a, signal)
    return filtered_signal