import type { CollectionQuery } from "./CollectionQuery"
import { Query as BaseQuery, where, limit, orderBy, DocumentData, query } from "firebase/firestore"

type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

export type Props<T> = Pick<T, NonFunctionPropertyNames<T>>;

export type PropsRequired<T, K extends keyof Props<T>> = Partial<Props<T>> & Required<Pick<Props<T>, K>>
export type PropsOptional<T, K extends keyof Props<T>> = Props<T> & Partial<Pick<Props<T>, K>>

export type ProxyWrapper<T, U> = {
  [K in keyof T]: T[K] extends (...a: any) => T
    ? (...a: Parameters<T[K]>) => ProxyWrapper<T, U>
    : T[K]
} & U

export type Unsubscriber = { unsubscribe(): void }

export class Query<T = DocumentData> extends BaseQuery<T> {
  where(...args: Parameters<typeof where>): this {
    return query(this, where(...args)) as this
  }
  
  limit(...args: Parameters<typeof limit>): this {
    return query(this, limit(...args)) as this
  }

  orderBy(...args: Parameters<typeof orderBy>): this {
    return query(this, orderBy(...args)) as this
  }
}
