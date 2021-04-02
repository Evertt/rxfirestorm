import type Model from "./Model"
import type { QueryProxy } from "./QueryProxy"
import type { ProxyWrapper, Unsubscriber } from "./types"
import type { CollectionReference } from "firebase/firestore"

import { db } from "./common"
import { Observable } from "rxjs"
import { countSubscription } from "./logging"
import { modelQuery, ModelQueryMethods } from "./ModelQuery"
import { collection, onSnapshot, Query } from "firebase/firestore"
import { initModel, extend, makeProxy, queryToString, queryStoreCache } from "./common"

export type CollectionQuery<ModelType extends typeof Model> = ProxyWrapper<QueryProxy, CollectionQueryMethods<ModelType>>
type CollectionQueryMethods<ModelType extends typeof Model> = CollectionStore<InstanceType<ModelType>> & {
  first(): ModelQueryMethods<ModelType>
  add(model: ConstructorParameters<ModelType>[0]): Promise<void>
}

export type CollectionStore<M extends Model> = Promise<M[]> & Observable<M[]> & Unsubscriber

export function collectionQuery<ModelType extends typeof Model>(
  ModelClass: ModelType,
  query: Query | CollectionReference = collection(db(), ModelClass.collection),
): CollectionQuery<ModelType> {
  const key = queryToString(query)

  if (queryStoreCache.has(key)) {
    return queryStoreCache.get(key)
  }

  const myCustomMethods = extend((new Observable<InstanceType<ModelType>[]>(
    subscriber => {
      queryStoreCache.set(key, proxy)

      const unsubscribe = onSnapshot(query,
        snapshot => subscriber.next(
          snapshot.docs.map(
            doc => initModel(ModelClass, doc),
          ),
        ),
      )

      const { name } = ModelClass
      countSubscription(name)

      return () => {
        unsubscribe()
        queryStoreCache.delete(key)
        countSubscription(name, -1)
      }
    },
  ))) as CollectionQueryMethods<ModelType>

  myCustomMethods.first = () => modelQuery(ModelClass, query)
  myCustomMethods.add = async model => {
    let data: any = { ... model }
    delete data.id
    delete data.docRef
    const modelClass = new ModelClass(data)
    await modelClass.save()
  }

  // Then we create a proxy
  const proxy = makeProxy(myCustomMethods, collectionQuery, query, ModelClass) as CollectionQuery<ModelType>

  return proxy
}
