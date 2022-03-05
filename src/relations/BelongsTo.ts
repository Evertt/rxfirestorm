import type Model from "../Model"
import { isModelClass } from "../utils"
import { DocumentReference } from "firebase/firestore"
import { ModelQuery, modelQuery } from "../ModelQuery"

export const BelongsTo = <ModelType extends typeof Model>(SubModelClass: ModelType | (() => ModelType)) => <
  Target extends Model & Record<Key, ModelQuery<ModelType>>, Key extends string | symbol
>(target: Target, key: Key): void => {
  if (SubModelClass === undefined) throw Error(
    "BelongsTo got passed an undefined Model class.\n"+
    "This may be caused by circular references.\n"+
    "Try using an arrow function that returns the Model class.")

  let id: string | null = null
  let model: InstanceType<ModelType> | null = null
  const ModelClass = () => isModelClass(SubModelClass) ? SubModelClass : SubModelClass()

  function get(this: InstanceType<ModelType>) {
    if (!id) return null
    return modelQuery(ModelClass(), model || id)
  }

  function set(this: InstanceType<ModelType>, newValue: any) {
    id = null, model = null
    if (!newValue) {
      id = null
    } else if (typeof newValue === "string") {
      id = newValue
    } else if (newValue instanceof ModelClass()) {
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