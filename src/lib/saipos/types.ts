export interface SaiposWebhookPayload {
  event: 'CONFIRMED' | 'READY_TO_DELIVER' | 'DISPATCHED' | 'CONCLUDED' | 'CANCELLED'
  cod_store: string
  order_id: string
}

export interface SaiposOrderResponse {
  customer: string
  created_at: string
  notes: string
  totalDiscount: number
  totalIncrease: number
  totalValue: number
  totalItems: number
  serviceFee: number
  orderStatus: number
}
