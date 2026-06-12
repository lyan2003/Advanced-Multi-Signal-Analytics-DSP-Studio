import io
import tempfile
import os
import numpy as np
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from sklearn.preprocessing import StandardScaler
from web_backend.app.schemas.eeg import EegPredictResponse
from web_backend.app.services import eeg_service

router = APIRouter(prefix="/api/eeg", tags=["EEG"])


@router.post("/predict", response_model=EegPredictResponse)
async def eeg_predict_endpoint(
        file: UploadFile = File(...),
        index: Optional[int] = Form(None),
        id_value: Optional[str] = Form(None),
        drop_id_from_features: bool = Form(True),
        model_path: Optional[str] = Form(None),
):
    """
    EEG prediction endpoint for tabular CSV datasets.
    """
    try:
        content = await file.read()
        if not content:
            raise ValueError("Empty file.")

        df = pd.read_csv(io.BytesIO(content))
        if df.shape[0] == 0:
            raise ValueError("CSV has no rows.")

        chosen_row_index, chosen_row_id = None, None
        first_col_name = df.columns[0]
        first_col_series = df.iloc[:, 0]

        if id_value is not None and str(id_value).strip() != "":
            if pd.api.types.is_numeric_dtype(first_col_series):
                try:
                    target = float(id_value)
                    mask = np.isclose(first_col_series.astype(float).values, target)
                except Exception:
                    mask = (first_col_series.astype(str).values == str(id_value))
            else:
                mask = (first_col_series.astype(str).values == str(id_value))

            idxs = np.flatnonzero(mask)
            if idxs.size == 0:
                raise HTTPException(status_code=404, detail=f"id_value not found.")
            chosen_row_index = int(idxs[0])
            chosen_row_id = str(df.iloc[chosen_row_index, 0])
        else:
            if index is None:
                raise HTTPException(status_code=400, detail="Provide index or id_value.")
            if index < 0 or index >= len(df):
                raise HTTPException(status_code=416, detail="Index out of range.")
            chosen_row_index = int(index)
            chosen_row_id = str(df.iloc[chosen_row_index, 0])

        X = df.drop(columns=["name", "status"], errors="ignore")
        if drop_id_from_features and X.shape[1] > 0:
            X = X.drop(columns=[X.columns[0]], errors="ignore")

        X = X.select_dtypes(include=[np.number]).copy()
        if X.shape[1] == 0:
            raise HTTPException(status_code=400, detail="No numeric features found.")

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = eeg_service.get_tabular_eeg_model(model_path)
        expected = int(model.input_shape[-1])
        actual = int(X_scaled.shape[1])

        if actual > expected:
            X_scaled = X_scaled[:, :expected]
        elif actual < expected:
            X_scaled = np.pad(X_scaled, ((0, 0), (0, expected - actual)))

        sample = X_scaled[chosen_row_index].reshape(1, -1)
        y_pred = model.predict(sample, verbose=0)
        prob = float(np.asarray(y_pred).reshape(-1)[0])
        label = "Parkinson's Detected" if prob > 0.5 else "Healthy"

        return EegPredictResponse(
            kind="eeg",
            row_index=chosen_row_index,
            row_id=chosen_row_id,
            prob=prob,
            label=label,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"EEG prediction failed: {e}")


@router.post("/edf/predict")
async def eeg_edf_predict(
        file: UploadFile = File(...),
        sampling_rate: int = Form(256),
        return_signal: bool = Form(False)
):
    """
    Perform EEG classification using an EDF file.
    """
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        x, rgb_img, data, times = eeg_service.process_edf_file(tmp_path, sampling_rate)

        model = eeg_service.get_edf_eeg_model()
        y_pred = model.predict(x, verbose=0)

        predicted_class = int(np.argmax(y_pred, axis=1)[0])
        confidence = float(np.max(y_pred))

        os.remove(tmp_path)

        response = {
            "kind": "eeg_image",
            "predicted_class": predicted_class,
            "confidence": confidence,
            "probabilities": y_pred.tolist(),
            "spectrogram": rgb_img.tolist()
        }

        if return_signal:
            response["signal"] = data.tolist()
            response["times"] = times.tolist()

        return response

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))