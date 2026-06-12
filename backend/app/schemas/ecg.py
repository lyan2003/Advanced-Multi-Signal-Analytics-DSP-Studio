from pydantic import BaseModel
from typing import List, Optional

class PredictResponse(BaseModel):
    """
    Response model for ECG predictions.
    """
    probs: List[float]
    labels: Optional[List[str]] = None