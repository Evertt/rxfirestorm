import type Model from "../Bla"
import { addSubscription } from "./common"
import type { CollectionQuery } from "../CollectionQuery"

export const SubCollection = <ModelType extends typeof Model>(SubModelClass: ModelType) => <
  Target extends Model & Record<Key, CollectionQuery<ModelType>>, Key extends string | symbol
>(target: Target, key: Key): void => {
  const setNewQuery = (t: any, id: string) => {
    const collectionPath = (target.constructor as any).collection

    const newClass = class extends (SubModelClass as any) {
      static collection = `${collectionPath}/${id}/${key}`
    }

    t[key] = newClass.query()
  }

  addSubscription(target, setNewQuery)
}