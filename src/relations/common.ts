import type Model from "../Model"

export const metadata = new Map()
const subs: ((t: any, id: string) => void)[] = []

export const addSubscription = <M extends Model>(model: M, fn: (t: any, id: string) => void): void => {
  function get(this: M) {
    return metadata.get(this)?.id
  }

  function set(this: M, id: string) {
    metadata.set(this, { id })
    subs.forEach((cb: (t: any, id: string) => void) => cb(this, id))
  }
  
  if (Object.getOwnPropertyDescriptor(model, "id") === undefined) {
    Object.defineProperty(model, "id", { get, set })
  }

  subs.push(fn)
}