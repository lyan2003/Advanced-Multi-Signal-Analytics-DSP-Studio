# Advanced Multi-Signal Analytics & Intelligent Voice Recognition Studio

>  **Note:** This project was originally developed between **October 6, 2025, and October 27, 2025**, as part of the university digital signal processing curriculum. It has been structurally refactored, modernized into a unified full-stack architecture, and migrated here for public portfolio showcase.

A high-performance, full-stack digital signal processing (DSP) web ecosystem designed for cross-platform multi-channel signal visualization, mathematical transformation, and deep learning-assisted diagnostic/speech inference. The platform couples a responsive **Next.js (TypeScript)** graphical layer with a distributed **FastAPI (Python)** computational engine to stream and analyze multi-modal biomedical, acoustic, radiofrequency, and vocal data structures in real time.

---

## Technical Pipeline Architecture

The platform architecture decouples heavy numerical processing loops (vectorized audio synthesis, matrix-based recurrence plots, audio downsampling/aliasing simulations, and deep learning tensor evaluations) from the presentation layout, securing an ultra-smooth 60fps data rendering cycle.

```text
+-------------------------------------------------------------------------+
|                        NEXT.JS FRONTEND LAYER (TS)                      |
|  (Interactive Viewports, Voice Record UI, Live Audio Canvas Plotters)   |
+-------------------------------------------------------------------------+
                                    |
                        REST API / WebSockets (JSON)
                                    v
+-------------------------------------------------------------------------+
|                        FASTAPI COMPUTATIONAL ENGINE                     |
|      (Asynchronous Request Routing, Payload Schema Val, File Streams)   |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                         DSP & DEEP LEARNING CORE                        |
|  [SciPy/NumPy Matrix Kernels] ---------> [PyTorch/TensorFlow Inference] |
|  (MFCCs, Sinc Interpolation, FFT)         (1D/2D-CNN & Speech Models)   |
+-------------------------------------------------------------------------+

```

---

## Core Algorithmic Capabilities

### 1. Multi-Channel Biomedical Analytics Suite (ECG / EEG)

Processes high-density multi-lead physiological data vectors to track synchronized cardiac and neurological abnormalities using dual 1D and 2D deep learning networks:

* **Viewport Render Modes:** Continuous-Time Viewport (with playback control), XOR Chrono-Graphing (differential interval verification), Polar Mapping Domain ($r = |S(t)|, \theta = \omega \cdot t$), and Recurrence Matrix Scattering ($Ch_X \times Ch_Y$).
* **Dual-Inference Pipeline:** Executes a pre-trained **1D-CNN** over raw multi-lead arrays simultaneously with a specialized **2D-CNN** reading graphical Recurrence textures to accurately classify distinct abnormality types.

### 2. Acoustic Signal Synthesis & Unmanned Vector Detection

* **Vehicle-Passing Doppler Simulator:** Implements kinematic acoustic modeling to synthesize real-time frequency compressions/dilations of an approaching horn based on adjustable velocity ($v Levant$) and source emission frequency ($f$).
* **Doppler Velocity Inverse Solver:** Features an AI regression layer trained on real vehicle fly-bys to evaluate changing acoustic patterns and estimate physical vehicle velocities.
* **Unmanned Autonomous Vector Detection:** Employs spectral fingerprinting models over specialized datasets to detect hidden acoustic traces of underwater submersibles or aerial drones amid high-ambient marine/atmospheric background noise.

### 3. Dynamic Sampling & Aliasing Simulation Framework (Task 2 Expansion)

Integrates interactive runtime controls over the data quantization layer to demonstrate Nyquist-Shannon sampling violations and observe real-time machine learning degradation:

* **Parametric Downsampling Sliders:** Embedded within the **Medical** and **Acoustic** viewports, allowing users to sweep the active sampling frequency ($f_s$). If $f_s < 2 \cdot f_{\text{max}}$, the system forces real-time spectral folding (aliasing).
* **AI Model Vulnerability Assessment:** Evaluates how under-sampling alters the raw frequency distributions of ECG/EEG arrays and audio profiles, causing critical distortions in calculated MFCCs and feature tensors, which results in AI model degradation, misclassifications, and dropouts.

### 4. Human Vocal Gender Classification & Anti-Aliasing Recovery (Task 2)

Provides an end-to-end audio processing engine to analyze arbitrary human voice recordings under severe signal degradation conditions:

* **Biometric Gender Classification:** Extracts foundational acoustic pitches, formants, and spectral centroids from an opened human voice file to classify the subject profile into **Male** or **Female**.
* **Aliasing Corruption Analysis:** Demonstrates how under-sampling causes the high-frequency components of the voice to wrap into lower spectral bands, significantly distorting the pitch profile and causing the gender classification model to fail or switch boundaries.
* **Anti-Aliasing Recovery Pipeline:** Employs a digital brick-wall low-pass filter (or Whittaker-Shannon Sinc interpolation) to clear folded artifacts and reconstruct the corrupted voice back into its original smooth natural state before feeding it clean to the AI model.

### 5. Radiofrequency (RF) Celestial & Radar Analytics

* **SAR/Cosmic Wave Interpretations:** Parses complex Synthetic Aperture Radar (SAR) and high-frequency cosmic wave vectors, generating interactive multi-spectral visualizations.
* **Information Inference Engine:** Utilizes spatial phase extraction models to estimate structural mapping layouts and structural surface metrics from incoming microwave signal echoes.

---

## Application Output Gallery

### Task 1: Multi-Signal Analytics & Viewport Dashboards
<table>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/eaf44a82-3cdf-4234-a883-4527d553d10d" alt="Signal Analytics 1" /></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/d0b4b748-3208-459e-89ec-858274456447" alt="Signal Analytics 2" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/7cece725-ac58-4742-932c-67c4bae455a1" alt="Signal Analytics 3" /></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/49413f41-80f0-4ad0-8c33-614dc87d67a5" alt="Signal Analytics 4" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/1ccdbdb2-b0c5-48f1-a5c3-6578848faa27" alt="Signal Analytics 5" /></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/157e8adb-8a38-4225-b02f-97ce51bb6188" alt="Signal Analytics 6" /></td>
  </tr>
</table>

### Task 2: Dynamic Sampling, Aliasing Simulation & Voice Reconstruction
<table>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/45b82fa5-cdef-4b44-8bea-dadd5710ed38" alt="Sampling Simulation 1" /></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/2061cf3d-8f21-4653-900c-d00e92e99515" alt="Sampling Simulation 2" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/481f7f05-fdb7-4c76-87f3-a6f160d0515d" alt="Aliasing Analysis 1" /></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/44719de3-f34d-4c28-aefa-29090a65d5f7" alt="Aliasing Analysis 2" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/c1e91dd7-5d47-4b36-a203-7f027fd72d28" alt="Voice Reconstruction" /></td>
    <td width="50%"></td>
  </tr>
</table>
---

### Project Demonstration Videos
<table>
  <tr>
    <td width="50%">
      <p align="center"><b>Biomedical Dashboard Demo</b></p>
      <video src="https://github.com/user-attachments/assets/0550b919-bc6a-4fb9-adb4-a9fa8364ad7c" controls width="100%">Your browser does not support the video tag.</video>
    </td>
     <td width="50%">
      <p align="center"><b>Dynamic Sampling & Aliasing Demo</b></p>
      <video src="https://github.com/user-attachments/assets/ee48b101-5db8-4fdc-829c-0f8fa4312ad9" controls width="100%">Your browser does not support the video tag.</video>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <p align="center"><b>Voice Recognition Demo</b></p>
      <video src="https://github.com/user-attachments/assets/ec12f034-05c0-4d5c-9468-c686486cbaca
" controls width="100%">Your browser does not support the video tag.</video>
    </td>
  </tr>
</table>
---

## Repository Directory Tree

```text
Advanced-Multi-Signal-Analytics-DSP-Studio/
├── backend/
│   ├── .venv/                      # Isolated Python runtime environment
│   ├── requirements.txt            # Computational and Deep Learning dependencies
│   ├── models/                     # Saved weights for 1D/2D CNN and Speech models
│   └── app/
│       ├── main.py                 # ASGI application bootstrap and server initialization
│       ├── schemas/                # Strict Pydantic data validation contracts (ecg.py, eeg.py)
│       ├── services/               # Heavy-lifting analytics (Downsampling, Sinc Filters, ML inferences)
│       │   ├── audio_service.py    # Doppler logic, downsampling, and anti-alias recovery algorithms
│       │   ├── drone_service.py
│       │   ├── ecg_service.py      # ECG signal streaming and downsampling simulation
│       │   ├── eeg_service.py      # EEG signal streaming and downsampling simulation
│       │   └── voice_service.py    # Voice feature processing and Male/Female classification logic
│       └── api/                    # REST endpoint routers grouping system capabilities
└── frontend/
    ├── package.json                # Project manifest and package dependencies
    ├── pnpm-lock.yaml              # Monitored lockfile ensuring deterministic toolchains
    ├── public/                     # Static media vectors, fonts, and asset matrices
    ├── utils/                      # Shared helper utilities and data processing transformers
    └── app/                        # Next.js App Router core directory tree
        ├── components/             # Interactive graphing viewports, sampling sliders, and recorders
        ├── medical/                # ECG/EEG interactive dashboard with active sampling sliders
        ├── acoustic/               # Doppler generator and Drone classification dashboard
        ├── voice_recognition/      # Vocal gender classification dashboard with anti-aliasing toggles
        └── rf/                     # Radar and cosmic wave analytics page

```

---

## Toolchain Setup and Deployment

### Backend Setup (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

```

### Frontend Setup (Next.js)

```bash
cd ../frontend
pnpm install
pnpm dev
