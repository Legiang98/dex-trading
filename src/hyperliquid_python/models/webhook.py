from pydantic import BaseModel, Field, field_validator
from typing import Optional, Union

class WebhookPayload(BaseModel):
    symbol: str
    action: str = Field(..., description="Action to perform (ENTRY, EXIT, UPDATE_STOP)")
    type: str = Field(..., description="Order type (BUY or SELL)")
    price: Union[float, str]
    stopLoss: Optional[Union[float, str]] = None
    strategy: Optional[str] = "Default"
    orderId: Optional[str] = None
    quantity: Optional[float] = None
    positionValue: Optional[float] = None
    
    @field_validator("action")
    def validate_action(cls, v: str) -> str:
        val = v.upper()
        if val not in ["ENTRY", "EXIT", "UPDATE_STOP"]:
            raise ValueError("action must be ENTRY, EXIT, or UPDATE_STOP")
        return val

    @field_validator("type")
    def validate_type(cls, v: str) -> str:
        val = v.upper()
        if val not in ["BUY", "SELL"]:
            raise ValueError("type must be BUY or SELL")
        return val

class ValidationResult(BaseModel):
    is_valid: bool
    reason: Optional[str] = None
    skipped: Optional[bool] = False
