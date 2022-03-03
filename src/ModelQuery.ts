import type Model from "./Model"
import type { Next } from "./common"
import type { QueryProxy } from "./QueryProxy"
import type { Unsubscriber, ProxyWrapper, Props } from "./types"
import type { DocumentReference, DocumentSnapshot } from "firebase/firestore"

import { Observable } from "rxjs"
import { throttle, sleep } from "./utils"
import { countSnapshot, countSubscription } from "./logging"
import { db, extend, initModel, makeProxy, queryStoreCache, queryToString } from "./common"
import { collection, doc, limit, query, onSnapshot, QuerySnapshot, Query } from "firebase/firestore"

export type ModelQuery<ModelType extends typeof Model> = ProxyWrapper<QueryProxy, ModelQueryMethods<ModelType>>
export type ModelQueryMethods<ModelType extends typeof Model> = ModelStore<InstanceType<ModelType>>

export type ModelStore<M extends Model> = Promise<M> & Observable<M> & Unsubscriber & {
  set: (data: M) => void
}

export function modelQuery<ModelType extends typeof Model>(ModelClass: ModelType): ModelQuery<ModelType>
export function modelQuery<ModelType extends typeof Model>(ModelClass: ModelType, id: string): ModelQuery<ModelType>
export function modelQuery<ModelType extends typeof Model>(ModelClass: ModelType, query: Query): ModelQuery<ModelType>
export function modelQuery<ModelType extends typeof Model>(
  ModelClass: ModelType, queryOrId?: Query | string,
): ModelQuery<ModelType> {
  queryOrId ??= collection(db(), ModelClass.collection)

  type D = Props<InstanceType<ModelType>>
  let queryOrRef: Query<D> | DocumentReference<D>
  let key: string

  switch (typeof queryOrId) {
    case "undefined":
      queryOrRef = query(collection(db(), ModelClass.collection), limit(1))
      key = queryToString(queryOrRef)
      break;
    case "string":
      key = `${ModelClass.collection}/${queryOrId}`
      queryOrRef = doc(collection(db(), ModelClass.collection), queryOrId)
      break;
    default:
      queryOrRef = query(queryOrId, limit(1))
      key = queryToString(queryOrRef)
  }

  if (queryStoreCache.has(key)) {
    return queryStoreCache.get(key) as ModelQuery<ModelType>
  }

  const myCustomMethods = extend((new Observable<InstanceType<ModelType>>(
    subscriber => {
      queryStoreCache.set(key, proxy)
      const { name } = ModelClass

      let snapshots = 0
      const handleSnapshot = async (snapshot: QuerySnapshot | DocumentSnapshot) => {
        snapshots++
        const model = await Promise.race([sleep(40), myCustomMethods])
        snapshot = snapshot instanceof QuerySnapshot ? snapshot.docs[0] : snapshot

        if (!snapshot || !snapshot.exists()) {
          if (snapshots > 1) return subscriber.next(undefined)
          return model || subscriber.error(new Error(`${ModelClass.name} not found.`))
        }

        countSnapshot(snapshot.ref.path)

        if (model) {
          Object.assign(model, snapshot.data())
          return subscriber.next(model as InstanceType<ModelType>)
        }

        return subscriber.next(initModel(ModelClass, snapshot))
      }

      // @ts-ignore
      const unsubscribe = onSnapshot(queryOrRef, handleSnapshot)

      countSubscription(name)

      return () => {
        unsubscribe()
        queryStoreCache.delete(key)
        countSubscription(name, -1)
      }
    },
  )), typeof window === "undefined" ? 60_000 : 1_000) as ModelStore<InstanceType<ModelType>> & Next<InstanceType<ModelType>>

  const throttledSave = throttle<typeof myCustomMethods.set>(
    newModel => newModel.save("update"), 50, 1000
  )

  // This set method makes it equivalent
  // to a writable svelte store.
  // When a property is set,
  // a debounced save is called.
  // This is done so that when code like this is run:
  // $article.title = "new title";
  // $article.body = "new body";
  // the save method will only be called once.
  myCustomMethods.set = newModel => {
    myCustomMethods.next(newModel)
    throttledSave(newModel)
  }

  // Then we create a proxy
  const proxy = makeProxy(
    myCustomMethods,
    modelQuery,
    queryOrRef as Query,
    ModelClass
  ) as ModelQuery<ModelType>

  return proxy
}
