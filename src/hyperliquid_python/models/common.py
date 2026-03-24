from pydantic import BaseModel
from typing import Optional, Dict

class OrderResult(BaseModel):
    success: bool
    orderId: Optional[str] = None
    stopLossOrderId: Optional[str] = None
    dbOrderId: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None

class AssetMetaItem(BaseModel):
    szDecimals: int

AssetMeta = Dict[str, AssetMetaItem]
