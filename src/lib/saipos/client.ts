import type { SaiposOrderResponse } from './types'

export async function getSaiposOrder(
  codStore: string,
  orderId: string,
  token: string
): Promise<SaiposOrderResponse | null> {
  const url = `https://order-api.saipos.com/order?cod_store=${codStore}&order_id=${orderId}`
  const res = await fetch(url, {
    headers: { Authorization: token },
    next: { revalidate: 0 },
  })
  if (!res.ok) return null
  return res.json() as Promise<SaiposOrderResponse>
}
