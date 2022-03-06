import type Model from "../Model"
import type { CollectionQuery } from "../CollectionQuery"
import { isModelClass } from "../utils"

export const SubCollection = <ModelType extends typeof Model>(SubModelClass: ModelType | (() => ModelType)) => <
  Target extends Model & Record<Key, CollectionQuery<ModelType>>, Key extends string | symbol
>(target: Target, key: Key): void => {
  if (SubModelClass === undefined) throw Error(
    "SubCollection got passed an undefined Model class.\n"+
    "This may be caused by circular references.\n"+
    "Try using an arrow function that returns the Model class.")

  const ModelClass = () => isModelClass(SubModelClass) ? SubModelClass : SubModelClass()

  function get(this: InstanceType<ModelType>) {
    const id = this.id
    const collectionPath = (this.constructor as any).collection
    const newClass = class extends (ModelClass() as any) {
      static collection = `${collectionPath}/${id}/${key}`
    }

    return newClass.query()
  }

  Object.defineProperty(target, key, { get })
}