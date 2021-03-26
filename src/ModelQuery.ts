import type Model from "./Model"
import { db } from "./common"
import { extend, initModel, makeProxy, queryStoreCache, queryToString } from "./common"
import { Observable, BehaviorSubject } from "rxjs"
import {
  Query, Unsubscriber, ProxyWrapper, Snapshot,
  isQuerySnapshot, QuerySnapshot, DocumentSnapshot
} from "./types"
import { snapshotCounts, subscriptionCounts } from "./logging"
import { isEqual, debounce } from "lodash"

export type ModelQuery<ModelType extends typeof Model> = ProxyWrapper<Query, ModelQueryMethods<ModelType>>
export type ModelQueryMethods<ModelType extends typeof Model> = ModelStore<InstanceType<ModelType>>

export type ModelStore<M extends Model> = Promise<M> & Observable<M> & Unsubscriber & {
  id: string
  saving: BehaviorSubject<boolean|null>
  set: (data: M) => Promise<void>
}

export function modelQuery<ModelType extends typeof Model>(
  ModelClass: ModelType,
  queryOrId: Query | string = db().collection(ModelClass.collection) as Query,
): ModelQuery<ModelType> {
  const query = typeof queryOrId === "string"
    ? db().collection(ModelClass.collection).doc(queryOrId) as unknown as Query
    : queryOrId

  if (query.limit === undefined) {
    (query as any).limit = () => query
  }

  const key = typeof queryOrId === "string"
    ? `${ModelClass.collection}/${queryOrId}`
    : queryToString(query.limit(1))

  if (queryStoreCache.has(key)) {
    return queryStoreCache.get(key)
  }

  const myCustomMethods = extend((new Observable<InstanceType<ModelType>>(
    subscriber => {
      queryStoreCache.set(key, proxy)
      const { name } = ModelClass

      const unsubscribe = query.limit(1).onSnapshot(
        async (snapshot: Snapshot) => {
          if ((snapshot as QuerySnapshot).empty === true || (snapshot as DocumentSnapshot).exists === false) {
            subscriber.error(new Error(`${ModelClass.name} not found.`))
          } else {
            const doc = (isQuerySnapshot(snapshot) ? snapshot.docs[0] : snapshot)
            snapshotCounts.next({
              ...snapshotCounts.value,
              [doc.ref.path]: (snapshotCounts.value[doc.ref.path] || 0) + 1,
            })
            const model = initModel(ModelClass, doc)
            if (myCustomMethods.saving.value !== false) {
              const maybeNewerModel = await myCustomMethods
              if (!isEqual(model.getStrippedData(), maybeNewerModel.getStrippedData())) {
                Object.assign(model, maybeNewerModel.getStrippedData())
                throttledSave(model)
                subscriber.next(model as any)
              } else {
                myCustomMethods.saving.next(false)
              }
            } else {
              subscriber.next(model as any)
            }
          }
        },
      )

      subscriptionCounts.next({
        ...subscriptionCounts.value,
        [name]: (subscriptionCounts.value[name] || 0) + 1,
      })

      return () => {
        unsubscribe()
        queryStoreCache.delete(key)
        subscriptionCounts.next({
          ...subscriptionCounts.value,
          [name]: (subscriptionCounts.value[name] || 0) - 1,
        })
      }
    },
  ))) as ModelStore<InstanceType<ModelType>>;

  myCustomMethods.saving = new BehaviorSubject<boolean|null>(false)

  const throttledSave = debounce((doc: InstanceType<ModelType>) => {
    myCustomMethods.saving.next(true)
    doc.save()
  }, 2000)

  myCustomMethods.set = async data => {
    if (myCustomMethods.saving.value === false) {
      myCustomMethods.saving.next(null)
    }
    const doc = await myCustomMethods
    Object.assign(doc, data)
    throttledSave(doc)
  }

  // Then we create a proxy
  const proxy = makeProxy(myCustomMethods, modelQuery, query, ModelClass) as ModelQuery<ModelType>

  return proxy
}
