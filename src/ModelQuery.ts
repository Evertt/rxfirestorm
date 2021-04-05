import type Model from "./Model"
import type { QueryProxy } from "./QueryProxy"
import type { Unsubscriber, ProxyWrapper, Props } from "./types"
import type { DocumentReference, DocumentSnapshot } from "firebase/firestore"

import { db } from "./common"
import { isEqual, debounce } from "lodash"
import { Observable, BehaviorSubject } from "rxjs"
import { countSnapshot, countSubscription } from "./logging"
import { extend, initModel, makeProxy, queryStoreCache, queryToString } from "./common"
import { collection, doc, limit, query, onSnapshot, QuerySnapshot, Query } from "firebase/firestore"

export type ModelQuery<ModelType extends typeof Model> = ProxyWrapper<QueryProxy, ModelQueryMethods<ModelType>>
export type ModelQueryMethods<ModelType extends typeof Model> = ModelStore<InstanceType<ModelType>>

export type ModelStore<M extends Model> = Promise<M> & Observable<M> & Unsubscriber & {
  id: string
  saving: BehaviorSubject<boolean|null>
  set: (data: M) => Promise<void>
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
    return queryStoreCache.get(key)
  }

  const myCustomMethods = extend((new Observable<InstanceType<ModelType>>(
    subscriber => {
      queryStoreCache.set(key, proxy)
      const { name } = ModelClass

      const handleSnapshot = async (snapshot: QuerySnapshot | DocumentSnapshot) => {
        snapshot = snapshot instanceof QuerySnapshot ? snapshot.docs[0] : snapshot

        if (!snapshot || !snapshot.exists()) {
          return subscriber.error(new Error(`${ModelClass.name} not found.`))
        }

        countSnapshot(snapshot.ref.path)
        const model = initModel(ModelClass, snapshot)

        if (myCustomMethods.saving.value === false) {
          return subscriber.next(model)
        }

        const maybeNewerModel = await myCustomMethods
        const exclude = ["id", "createdAt", "updatedAt"]
        const incomingData = model.toJSON({ exclude } as any)
        const maybeNewerData = maybeNewerModel.toJSON({ exclude } as any)

        if (isEqual(incomingData, maybeNewerData)) {
          return myCustomMethods.saving.next(false)
        }

        Object.assign(model, maybeNewerData)
        throttledSave(model)
        subscriber.next(model)
      }

      const unsubscribe = queryOrRef instanceof Query
        ? onSnapshot(queryOrRef, handleSnapshot)
        : onSnapshot(queryOrRef, handleSnapshot)

      countSubscription(name)

      return () => {
        unsubscribe()
        queryStoreCache.delete(key)
        countSubscription(name, -1)
      }
    },
  )), typeof window === "undefined" ? 60_000 : 1_000) as ModelStore<InstanceType<ModelType>>;

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
  const proxy = makeProxy(myCustomMethods, modelQuery, queryOrRef as Query, ModelClass) as ModelQuery<ModelType>

  return proxy
}
