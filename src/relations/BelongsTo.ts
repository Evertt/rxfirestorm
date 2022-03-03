import type Model from "../Model"
import { DocumentReference } from "firebase/firestore"
import { ModelQuery, modelQuery } from "../ModelQuery"

export const BelongsTo = <ModelType extends typeof Model>(SubModelClass: ModelType) => <
  Target extends Model & Record<Key, ModelQuery<ModelType>>, Key extends string | symbol
>(target: Target, key: Key): void => {
  let id: string | null = null
  let model: typeof SubModelClass | null = null

  function get(this: InstanceType<ModelType>) {
    if (!id) return null
    let query = modelQuery(SubModelClass, id)
    if (model) {
      (query as any).next(model)
      model = null
    }
    return query
  }

  function set(this: InstanceType<ModelType>, newValue: any) {
    if (!newValue) {
      id = null
    } else if (typeof newValue === "string") {
      id = newValue
    } else if (newValue instanceof SubModelClass) {
      id = newValue.id
      model = newValue as any
    } else if (newValue instanceof DocumentReference) {
      id = newValue.id
    } else {
      throw new Error("BelongsTo assignment not the right type")
    }
  }

  Object.defineProperty(target, key, { get, set })
}