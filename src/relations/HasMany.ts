import type Model from "../Model"
import { getDocRef } from "../Model"
import { CollectionQuery, collectionQuery } from "../CollectionQuery"

export const HasMany = <ModelType extends typeof Model>(SubModelClass: ModelType, foreignKey: string) => <
  Target extends Model & Record<Key, CollectionQuery<ModelType>>, Key extends string | symbol
>(target: Target, key: Key): void => {

  function get(this: InstanceType<ModelType>) {
    return collectionQuery(SubModelClass).where(foreignKey, "==", getDocRef(this))
  }

  Object.defineProperty(target, key, { get })
}