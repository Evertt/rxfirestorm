import type Model from "../Bla"
import { Observable } from "rxjs"
import { extend } from "../common"
import { metadata } from "./common"
import { ModelQuery, modelQuery } from "../ModelQuery"
import { startWith } from "rxjs/operators"

export const BelongsTo = <ModelType extends typeof Model>(SubModelClass: ModelType) => <
  Target extends Model & Record<Key, ModelQuery<ModelType>>, Key extends string | symbol
>(target: Target, key: Key): void => {
  function get(this: InstanceType<ModelType>) {
    const md = metadata.get(this) || {}

    return md[key]
  }

  function set(this: InstanceType<ModelType>, newValue: any) {
    let query: any

    if (!newValue) {
    } else if (typeof newValue === "string") {
      query = newValue
    } else if (newValue.docRef != null) {
      query = newValue.docRef.id
    } else if (newValue.id != null) {
      query = newValue.id
    } else {
      newValue = extend(new Observable().pipe(startWith(newValue)))
    }

    metadata.set(this, {
      ...metadata.get(this),
      [key]: query ? modelQuery(SubModelClass as any, query as any) : newValue,
    })
  }

  Object.defineProperty(target, key, { get, set })
}