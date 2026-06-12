import os
import numpy as np
from fastapi import APIRouter, UploadFile, File
from web_backend.app.services import voice_service

router = APIRouter(prefix="/api/voice", tags=["Voice"])

@router.post("/predict")
async def voice_predict(file: UploadFile = File(...)):
    """
    Predict speaker gender from an uploaded audio file.
    """
    try:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        x = voice_service.extract_voice_features(temp_path)
        model = voice_service.get_voice_model()
        prediction = model.predict(x)

        if prediction.shape[-1] == 1:
            confidence = float(prediction[0][0])
            label = "Female" if confidence > 0.5 else "Male"
            confidence = confidence if label == "Female" else 1 - confidence
        else:
            avg_pred = np.mean(prediction, axis=0)
            label_idx = np.argmax(avg_pred)
            label = ["Male", "Female"][label_idx]
            confidence = float(avg_pred[label_idx])

        os.remove(temp_path)

        return {"label": label, "confidence": confidence}

    except Exception as e:
        return {"error": str(e)}