from pydantic import BaseModel
from typing import Optional

class EegPredictResponse(BaseModel):
    """
    Response schema for EEG tabular predictions.
    """
    kind: str = "eeg"
    row_index: int
    row_id: Optional[str] = None
    prob: float
    label: str