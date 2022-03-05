import type Model from "./Model"
import { transform, isEqualWith, isEqual, isObject, difference as arrayDiff } from "lodash"

type Fn = (...args: any[]) => any

export interface ThrottledFunc<T extends Fn> {
  (...args: Parameters<T>): Promise<ReturnType<T>>;
}

export const sleep = (ms: number) =>
  new Promise(r => setTimeout(r, ms))

export function throttle<T extends Fn>(fn: T, ...delays: number[]): ThrottledFunc<T> {
  let t1: NodeJS.Timeout|undefined
  let t2: NodeJS.Timeout|undefined
  let activeDelay = 0
  let lastArgs: Parameters<T>
  let promise: Promise<ReturnType<T>> | null = null

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    lastArgs = args

    promise ??= new Promise(resolve => {
      t1 = setTimeout(async () => {
        const result = fn(...lastArgs) as ReturnType<T>
        t1 = undefined
  
        // Increment the active delay each time
        // and then stick with the last one.
        activeDelay = Math.min(activeDelay + 1, delays.length - 1)
  
        // Set a 2nd `Timeout` that resets the
        // active delay back to the first one.
        t2 = setTimeout(() => {
          activeDelay = 0
          t2 = undefined
        }, delays[activeDelay])

        resolve(await result)
        promise = null
      }, delays[activeDelay])
    })
    
    if (t2) {
      clearTimeout(t2)
      t2 = undefined
    }

    return promise
  }
}

function customizer(baseValue: any, value: any) {
  if (Array.isArray(baseValue) && Array.isArray(value)) {
    return baseValue.length === value.length
      && isEqual([ ...baseValue ].sort(), [ ...value ].sort())
  }

  return isEqual(baseValue, value)
}

export function difference(object: any, base: any) {
  function changes(object: any, base: any) {
    return transform(object, (result: any, value, key) => {
      if (isEqualWith(value, base[key], customizer)) return
      
      if (Array.isArray(value) && Array.isArray(base[key]))
        result[key] = arrayDiff(value, base[key])
        
      else if (isObject(value) && isObject(base[key]))
        result[key] = changes(value, base[key])
      
      result[key] = value
    }, {})
  }

  return changes({ ...object }, { ...base })
}

export function isModelClass(v: Function | typeof Model): v is typeof Model {
  return typeof v === 'function' && /^\s*class\s+/.test(v.toString());
}
