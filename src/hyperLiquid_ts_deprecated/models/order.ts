export interface OrderRecord {
  partitionKey: string;
  id: string;
  user_address: string;
  symbol: string;
  strategy: string;
  quantity: number;
  order_type: string;
  price: number;
  oid: string;
  stopLossOid?: string;
  stopLossPrice?: number;
  pnl?: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface NewOrder {
  user_address: string;
  symbol: string;
  strategy: string;
  quantity: number;
  order_type: string;
  price: number | string;
  oid: string;
  stopLossOid?: string;
  stopLossPrice?: number | string;
  status: string;
}
