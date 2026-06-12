from fastapi import APIRouter, UploadFile, File, HTTPException
from web_backend.app.services import drone_service
from web_backend.app.core import config

router = APIRouter(prefix="/api", tags=["Drone Detection"])

@router.post("/detect")
async def detect_drone(file: UploadFile = File(...)):
    """
    Detect the presence of a drone in an uploaded audio recording.
    """
    drone_clf = drone_service.get_drone_classifier()
    if drone_clf is None:
        raise HTTPException(status_code=500, detail="Drone model not loaded.")

    try:
        file_bytes = await file.read()
        signal = drone_service.preprocess_drone_audio(file_bytes)

        outputs = drone_clf(
            {
                "array": signal,
                "sampling_rate": config.DRONE_TARGET_SR
            },
            top_k=2
        )

        scores = {item["label"]: float(item["score"]) for item in outputs}
        prob_drone = scores.get("drone", 0.0)
        label = "drone" if prob_drone >= 0.5 else "not_drone"

        return {
            "label": label,
            "probability": prob_drone,
            "topk": outputs
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Drone detection failed: {e}")