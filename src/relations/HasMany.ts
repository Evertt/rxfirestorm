import type Model from "../Model"
import { getDocRef } from "../Model"
import { isModelClass } from "../utils"
import { CollectionQuery, collectionQuery } from "../CollectionQuery"

export const HasMany = <ModelType extends typeof Model>(SubModelClass: ModelType | (() => ModelType), foreignKey: string) => <
  Target extends Model & Record<Key, CollectionQuery<ModelType>>, Key extends string | symbol
>(target: Target, key: Key): void => {
  if (SubModelClass === undefined) throw Error(
    "HasMany got passed an undefined Model class.\n"+
    "This may be caused by circular references.\n"+
    "Try using an arrow function that returns the Model class.")

  const ModelClass = () => isModelClass(SubModelClass) ? SubModelClass : SubModelClass()

  function get(this: InstanceType<ModelType>) {
    const query = collectionQuery(ModelClass()).where(foreignKey, "==", getDocRef(this))
    const ogAdd = query.add
    query.add = async model => {
      (model as any)[foreignKey] = this
      return ogAdd(model)
    }
    
    return query
  }

  Object.defineProperty(target, key, { get })
}