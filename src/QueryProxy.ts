import { Query, query, where, orderBy, limit, limitToLast, startAt, startAfter, endAt, endBefore } from "firebase/firestore"

const proxyHintKey = "__isProxiedQuery"

export type QueryProxy = {
  [K in keyof Query]: Query[K] extends ((...args: any[]) => Query)
    ? ((...args: Parameters<Query[K]>) => QueryProxy) : K;
} & {
  where(...args: Parameters<typeof where>): QueryProxy
  orderBy(...args: Parameters<typeof orderBy>): QueryProxy
  limit(...args: Parameters<typeof limit>): QueryProxy
  limitToLast(...args: Parameters<typeof limitToLast>): QueryProxy
  startAt(...args: Parameters<typeof startAt>): QueryProxy
  startAfter(...args: Parameters<typeof startAfter>): QueryProxy
  endAt(...args: Parameters<typeof endAt>): QueryProxy
  endBefore(...args: Parameters<typeof endBefore>): QueryProxy
}

const methods: Record<string, Function> = {
  where, orderBy,
  limit, limitToLast,
  startAt, startAfter,
  endAt, endBefore
}

function isProxiedQuery(q: Query | QueryProxy): q is QueryProxy {
  return !!(q as any)[proxyHintKey]
}

export function proxyQuery(q: Query | QueryProxy): QueryProxy {
  if (isProxiedQuery(q)) return q

  return new Proxy(q, {
    get(target, key, receiver) {
      if (key === proxyHintKey) return true

      const prop = Reflect.get(target, key, receiver)

      if (typeof prop === "function") {
        return (...args: any[]) => {
          const method = prop.bind(target)
          const result = method(...args)

          if (result instanceof Query) {
            return proxyQuery(result)
          }

          return result
        }
      }

      if (typeof prop === "undefined" && key in methods) {
        return (...args: any[]) => {
          const constraint = methods[key as string](...args)
          const newQuery = query(q, constraint)
          return proxyQuery(newQuery)
        }
      }

      return prop
    }
  }) as unknown as QueryProxy
}
