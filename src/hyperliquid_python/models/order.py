from pydantic import BaseModel
from typing import Optional, Union
from datetime import datetime

class OrderRecord(BaseModel):
    partitionKey: str
    id: str
    user_address: str
    symbol: str
    strategy: str
    quantity: float
    order_type: str
    price: float
    oid: str
    stopLossOid: Optional[str] = None
    stopLossPrice: Optional[float] = None
    pnl: Optional[float] = None
    status: str
    created_at: datetime
    updated_at: datetime

class NewOrder(BaseModel):
    user_address: str
    symbol: str
    strategy: str
    quantity: float
    order_type: str
    price: Union[float, str]
    oid: str
    stopLossOid: Optional[str] = None
    stopLossPrice: Optional[Union[float, str]] = None
    status: str
