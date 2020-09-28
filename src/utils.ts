import { transform, isEqualWith, isEqual, isObject } from "lodash"

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
