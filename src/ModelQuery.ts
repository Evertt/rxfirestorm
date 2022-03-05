import type Model from "./Model"
import type { Next } from "./common"
import type { QueryProxy } from "./QueryProxy"
import type { Unsubscriber, ProxyWrapper, Props } from "./types"
import type { DocumentReference, DocumentSnapshot } from "firebase/firestore"

import { Observable } from "rxjs"
import { throttle } from "./utils"
import { countSnapshot, countSubscription } from "./logging"
import { db, extend, initModel, makeProxy, queryStoreCache, queryToString } from "./common"
import { collection, doc, limit, query, onSnapshot, QuerySnapshot, Query } from "firebase/firestore"

export type ModelQuery<ModelType extends typeof Model> = ProxyWrapper<QueryProxy, ModelQueryMethods<ModelType>>
export type ModelQueryMethods<ModelType extends typeof Model> = ModelStore<InstanceType<ModelType>>

export type ModelStore<M extends Model> = Promise<M> & Observable<M> & Unsubscriber & {
  set: (data: M) => void
}

export function modelQuery<ModelType extends typeof Model>(
  ModelClass: ModelType,
  qim: InstanceType<ModelType> | Query | string = collection(db(), ModelClass.collection),
): ModelQuery<ModelType> {

  type D = Props<InstanceType<ModelType>>
  let queryOrRef: Query<D> | DocumentReference<D>
  let key: string

  if (typeof qim === "string") {
    key = `${ModelClass.collection}/${qim}`
    queryOrRef = doc(collection(db(), ModelClass.collection), qim)
  }
  else if (qim instanceof ModelClass) {
    key = `${ModelClass.collection}/${qim.id}`
    queryOrRef = doc(collection(db(), ModelClass.collection), qim.id)
  }
  else {
    queryOrRef = query(qim, limit(1))
    key = queryToString(queryOrRef)
  }

  if (queryStoreCache.has(key)) {
    return queryStoreCache.get(key) as ModelQuery<ModelType>
  }

  const myCustomMethods = extend((new Observable<InstanceType<ModelType>>(
    subscriber => {
      queryStoreCache.set(key, proxy)
      const { name } = ModelClass

      let snapshotCount = 0
      const handleSnapshot = async (snapshot: QuerySnapshot | DocumentSnapshot) => {
        snapshotCount++
        snapshot = snapshot instanceof QuerySnapshot ? snapshot.docs[0] : snapshot

        if (!snapshot || !snapshot.exists()) {
          if (snapshotCount > 1) return subscriber.next(undefined)
          return qim instanceof ModelClass ? subscriber.next(qim)
            : subscriber.error(new Error(`${ModelClass.name} not found.`))
        }

        countSnapshot(snapshot.ref.path)

        // TODO: decide whether to use this code or throw it away...
        // const model = await Promise.race([myCustomMethods, sleep(40)])

        // if (model) {
        //   Object.assign(model, snapshot.data())
        //   return subscriber.next(model as InstanceType<ModelType>)
        // }

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
