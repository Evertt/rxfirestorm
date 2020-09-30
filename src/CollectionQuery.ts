import WeakRef from "./WeakRef"
import Model, { db } from "./Model"
import type FBClient from "firebase"
import { Observable, Subject } from "rxjs"
import { subscriptionCounts } from "./logging"
import { modelQuery, ModelQueryMethods } from "./ModelQuery"
import type { Query, ProxyWrapper, Unsubscriber } from "./types"
import { initModel, extend, makeProxy, queryToString, queryStoreCache } from "./common"

export type CollectionQuery<ModelType extends typeof Model> = ProxyWrapper<Query, CollectionQueryMethods<ModelType>>
type CollectionQueryMethods<ModelType extends typeof Model> = CollectionStore<InstanceType<ModelType>> & {
  first(): ModelQueryMethods<ModelType>
  add(model: ConstructorParameters<ModelType>[0]): Promise<void>
}

export type CollectionStore<M extends Model> = Promise<M[]> & Observable<M[]> & Unsubscriber

export function collectionQuery<ModelType extends typeof Model>(
  ModelClass: ModelType,
  query: Query = db().collection(ModelClass.collection) as Query,
): CollectionQuery<ModelType> {
  const unsubscriber = new Subject<void>()

  const myCustomMethods = extend((new Observable<InstanceType<ModelType>[]>(
    subscriber => {
      const unsubscribe = (query as FBClient.firestore.Query).onSnapshot(
        snapshot => subscriber.next(
          snapshot.docs.map(
            doc => initModel(ModelClass, doc),
          ),
        ),
      )

      const { name } = ModelClass
      subscriptionCounts.next({
        ...subscriptionCounts.value,
        [name]: (subscriptionCounts.value[name] || 0) + 1,
      })

      return () => {
        unsubscribe()
        subscriptionCounts.next({
          ...subscriptionCounts.value,
          [name]: (subscriptionCounts.value[name] || 0) - 1,
        })
      }
    },
  )), unsubscriber) as CollectionQueryMethods<ModelType>

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

  const key = queryToString(query)
  const cachedQueryStore = queryStoreCache.get(key)
  if (cachedQueryStore && cachedQueryStore.deref()) {
    return cachedQueryStore.deref()
  }
  queryStoreCache.set(key, new WeakRef(proxy))

  return proxy
}
