import { transform, isEqualWith, isEqual, isObject } from "lodash"

type Fn = (...args: any[]) => any

export interface ThrottledFunc<T extends Fn> {
  (...args: Parameters<T>): Promise<void>|undefined;
}

export function throttle<T extends Fn>(fn: T, ...delays: number[]): ThrottledFunc<T> {
  let t1: NodeJS.Timeout|undefined
  let t2: NodeJS.Timeout|undefined
  let activeDelay = 0
  let lastArgs: Parameters<T>

  return (...args: Parameters<T>) => {
    lastArgs = args
    
    if (t2) {
      clearTimeout(t2)
      t2 = undefined
    }

    if (t1) {
      return undefined
    }

    return new Promise<void>(resolve => {
      t1 = setTimeout(async () => {
        const result = fn(...lastArgs)
        t1 = undefined
  
        // Increment the active delay each time
        // and then stick with the last one.
        // eslint-disable-next-line no-plusplus
        activeDelay = Math.min(++activeDelay, delays.length - 1)
  
        // Set a 2nd `Timeout` that resets the
        // active delay back to the first one.
        t2 = setTimeout(() => {
          activeDelay = 0
          t2 = undefined
        }, delays[activeDelay])

        if (typeof result === "object" && "then" in result) {
          await result
        }
        
        resolve()
      }, delays[activeDelay])
    })
  }
}

function customizer(baseValue: any, value: any): boolean {
  if (Array.isArray(baseValue) && Array.isArray(value)) {
    return isEqual(baseValue.sort(), value.sort())
  }

  if (baseValue && baseValue.firestore && value && value.firestore) {
    return baseValue.path === value.path
  }

  return isEqual(baseValue, value)
}

export function difference(object: any, base: any): any {
  function changes(object: any, base: any) {
    return transform(object, (result: any, value: any, key: string) => {
      if (!isEqualWith(value, base[key], customizer)) {
        result[key] = (isObject(value) && isObject(base[key])) ? changes(value, base[key]) : value
      }
    }, {})
  }

  if (object.docRef) {
    object = { ...object }
    delete object.docRef
  }

  if (base.docRef) {
    base = { ...base }
    delete base.docRef
  }

  return changes(object, base)
}
