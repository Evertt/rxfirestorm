import type Model from "./Model"
import type { ModelQuery } from "./ModelQuery"
import type { CollectionQuery } from "./CollectionQuery"
import type { QueryProxy } from "./QueryProxy"
import type { FirebaseFirestore } from "firebase/firestore"

import { share, tap } from "rxjs/operators"
import { proxyQuery } from "./QueryProxy"
import { Query, DocumentSnapshot,
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence
} from "firebase/firestore"
import { Observable, Subject, ReplaySubject, firstValueFrom, timer } from "rxjs"

let fs: FirebaseFirestore

export function init(firestore: FirebaseFirestore, enableCaching = true) {
  fs = firestore
  if (enableCaching) enableMultiTabIndexedDbPersistence(fs)
    .catch(_ => enableIndexedDbPersistence(fs)).catch(() => {})
}

export const db = () => fs

export const queryStoreCache = new Map<string, ModelQuery<any> | CollectionQuery<any>>()

export function queryToString(query: Query): string {
  const possibleKeys = ["_query", "_queryOptions", "jd", "d_"]

  for (const key of possibleKeys) {
    if (key in query) {
      return JSON.stringify((query as any)[key])
    }
  }

  throw Error("Query in query could not be found")
}

export function initModel<ModelType extends typeof Model>(ModelClass: ModelType, doc: DocumentSnapshot): InstanceType<ModelType> {
  const data = doc.data()

  for (const key in data) {
    if (data[key] && typeof data[key] === "object" && "toDate" in data[key]) {
      data[key] = data[key].toDate()
    }
  }

  return new ModelClass({
    id: doc.id, ...data,
  }) as InstanceType<ModelType>
}

const calledBySvelteAwaitBlock = (n: number) =>
  new Error().stack?.split("\n")[n].includes("is_promise")

export function makeProxy<ModelType extends typeof Model>(customMethods: any, cb: any, query: Query | QueryProxy, ModelClass: ModelType) {
  query = proxyQuery(query)

  return new Proxy(customMethods, {
    get(target, prop, receiver) {
      if (prop === "then" && typeof window === "undefined") {
        // This is a hack to make this library work properly
        // with a SvelteKit {#await} block during SSR.
        if (calledBySvelteAwaitBlock(3) && target.value) {
          return undefined
        }
      }

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
          if (result instanceof Query) {
            // If it is, then wrap that in another Collection type
            return cb(ModelClass, result)
          }
          // If not, then just return the result transparently.
          return result
        }
      }

      // Continuation of the SvelteKit SSR {#await} block hack
      if (typeof queryProp === "undefined" && typeof window === "undefined" && target.value) {
        return Reflect.get(target.value, prop, receiver)
      }

      // If queryFunc anything other than a function,
      // then just return that without wrapping it.
      return queryProp
    },
  })
}

export type Next<T> = Pick<Subject<T>, "next">

export const extend = <T>(observable: Observable<T>, ttl = 60_000): Observable<T> & Next<T> & Promise<T> => {
  const subject = new ReplaySubject<T>(1, Infinity)
  let lastValue: any
  const onFulfilleds: Function[] = []
  const onRejecteds: Function[] = []

  const combined = observable.pipe(
    share({
      connector: () => subject, // = new ReplaySubject(1, Infinity),
      resetOnError: true,
      resetOnComplete: false,
      resetOnRefCountZero: () => timer(ttl),
    }),
    tap({
      next: value => {
        lastValue = value
        for (const onFulfilled of onFulfilleds) {
          try { onFulfilled(value) }
          catch (_) {}
        }
      },
      error: error => {
        for (const onRejected of onRejecteds) {
          try { onRejected(error) }
          catch (_) {}
        }
      },
    })
  )  as Observable<T> & Next<T> & Promise<T>

  combined.then = (onFulfilled, onRejected) => {
    if (calledBySvelteAwaitBlock(3)) {
      onFulfilled && onFulfilleds.push(onFulfilled)
      onRejected && onRejecteds.push(onRejected)
    }

    return firstValueFrom(combined).then(onFulfilled, onRejected)
  }
  combined.catch = onRejected => firstValueFrom(combined).catch(onRejected)
  combined.finally = onFinally => firstValueFrom(combined).finally(onFinally)
  combined.next = (value: T) => subject.next(value)

  Object.defineProperty(combined, "value", { get: () => lastValue })

  return combined
}
