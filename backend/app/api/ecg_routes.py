import io
import pandas as pd
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from web_backend.app.schemas.ecg import PredictResponse
from web_backend.app.services import ecg_service

router = APIRouter(prefix="/api", tags=["ECG"])


@router.post("/predict", response_model=PredictResponse)
async def ecg_predict_endpoint(
        file: UploadFile = File(...),
        model_path: Optional[str] = Form(None),
):
    """
    ECG prediction endpoint from CSV.
    """
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))

        x = ecg_service.df_to_ecg_array(df, target_len=4096)
        model = ecg_service.get_ecg_model(model_path)

        y_score = model.predict(x, verbose=0)
        probs = np.asarray(y_score, dtype=float).reshape(-1).tolist()

        labels = ecg_service.get_ecg_labels()
        final_labels = labels if labels and len(labels) == len(probs) else None

        return PredictResponse(probs=probs, labels=final_labels)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ECG prediction failed: {e}")