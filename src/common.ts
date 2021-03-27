import type Model from "./Model"
import type FBClient from "firebase"
import type FBAdmin from "firebase-admin"
import { Observable, firstValueFrom, MonoTypeOperatorFunction, observable } from "rxjs"
import { shareReplay } from "rxjs/operators"
import { Query, isQuery, DocumentSnapshot } from "./types"

let fs: FBAdmin.firestore.Firestore | FBClient.firestore.Firestore
let sTS: () => FBAdmin.firestore.FieldValue | FBClient.firestore.FieldValue

export function init(
  firestore: FBAdmin.firestore.Firestore | FBClient.firestore.Firestore,
  serverTimestampField: () => FBAdmin.firestore.FieldValue | FBClient.firestore.FieldValue
) {
  fs = firestore
  sTS = serverTimestampField
}

export const db = () => fs
export const serverTimestamp = () => sTS

export const queryStoreCache = new Map()

export function queryToString(query: Query): string {
  const possibleKeys = ["_query", "_queryOptions", "jd", "d_"]

  for (const key of possibleKeys) {
    if (key in query) {
      return JSON.stringify((query as any)[key])
    }
  }

  throw Error("Query in query could not be found")
}

function delayedUnsubscribe<T>(ms: number): MonoTypeOperatorFunction<T> {
  const unsubTimers = new Map()
  return source => new Observable<T>(subscriber => {
    clearTimeout(unsubTimers.get(subscriber))
    unsubTimers.delete(subscriber)

    const subscription = source.subscribe({
      next(value) {
        !unsubTimers.has(subscriber) && subscriber.next(value);
      },
      error(error) {
        !unsubTimers.has(subscriber) && subscriber.error(error);
      },
      complete() {
        !unsubTimers.has(subscriber) && subscriber.complete();
      }
    })

    return () => {
      unsubTimers.set(subscriber, setTimeout(() => {
        subscription?.unsubscribe()
      }, ms))
    }
  })
}

export function initModel<ModelType extends typeof Model>(ModelClass: ModelType, doc: DocumentSnapshot): InstanceType<ModelType> {
  const data = doc.data()

  for (const key in data) {
    if (data[key] && typeof data[key] === "object" && "toDate" in data[key]) {
      data[key] = data[key].toDate()
    }
  }

  return new ModelClass({
    id: doc.id,
    docRef: doc.ref,
    ...data,
  }) as InstanceType<ModelType>
}

export function makeProxy<ModelType extends typeof Model>(customMethods: any, cb: any, query: Query, ModelClass: ModelType) {
  return new Proxy(customMethods, {
    get(target, prop, receiver) {
      // If the requested prop is in our custom methods thingy,
      // then that takes precedent.
      if (prop in target) {
        return Reflect.get(target, prop, receiver)
      }

      // Otherwise we take a look into the query object we have
      const queryProp = Reflect.get(query, prop, receiver) as any

      // If the requested prop is indeed a function on the query object
      if (typeof queryProp === "function") {
        // Then we return a slightly altered version of that function.
        return (...args: any[]) => {
          // Which forwards the call to the function on the query object.
          const queryMethod = queryProp.bind(query)
          const result = queryMethod(...args)

          // And then checks if the result is another query object.
          if (isQuery(result)) {
            // If it is, then wrap that in another Collection type
            return cb(ModelClass, result)
          }
          // If not, then just return the result transparently.
          return result
        }
      }

      // If queryFunc anything other than a function,
      // then just return that without wrapping it.
      return queryProp
    },
  })
}

export const extend = <T>(observable: Observable<T>): Observable<T> & Promise<T> => {
  const combined = observable.pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
    delayedUnsubscribe(1000),
  )  as Observable<T> & Promise<T>

  combined.then = (onFulfilled, onRejected) => firstValueFrom(combined).then(onFulfilled, onRejected)
  combined.catch = onRejected => firstValueFrom(combined).catch(onRejected)
  combined.finally = onFinally => firstValueFrom(combined).finally(onFinally)

  return combined
}
