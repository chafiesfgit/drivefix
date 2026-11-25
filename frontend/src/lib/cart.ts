import { useSyncExternalStore } from 'react'

export interface CartItem {
  offerId: string
  partId: string
  partName: string
  supplierId: string
  supplierName?: string
  price: number
  condition: 'NEW' | 'USED'
  stock: number
  qty: number
}

const KEY = 'df.cart'
let items: CartItem[] = read()
const listeners = new Set<() => void>()

function read(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as CartItem[]
  } catch {
    return []
  }
}

function write(next: CartItem[]) {
  items = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export const cart = {
  get: () => items,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  add(item: Omit<CartItem, 'qty'>, qty = 1) {
    const existing = items.find((i) => i.offerId === item.offerId)
    if (existing) write(items.map((i) => (i.offerId === item.offerId ? { ...i, qty: Math.min(i.stock, i.qty + qty) } : i)))
    else write([...items, { ...item, qty: Math.min(item.stock, qty) }])
  },
  setQty(offerId: string, qty: number) {
    write(items.map((i) => (i.offerId === offerId ? { ...i, qty: Math.max(1, Math.min(i.stock, qty)) } : i)))
  },
  remove(offerId: string) {
    write(items.filter((i) => i.offerId !== offerId))
  },
  clear() {
    write([])
  },
}

export function useCart() {
  const list = useSyncExternalStore(cart.subscribe, cart.get, cart.get)
  const count = list.reduce((s, i) => s + i.qty, 0)
  const subtotal = list.reduce((s, i) => s + i.qty * i.price, 0)
  return { items: list, count, subtotal }
}
