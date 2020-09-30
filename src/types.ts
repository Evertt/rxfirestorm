import type FBClient from "firebase"
import type FBAdmin from "firebase-admin"
import type { CollectionQuery } from "./CollectionQuery"

export type Query = FBAdmin.firestore.Query | FBClient.firestore.Query
export type QuerySnapshot = FBAdmin.firestore.QuerySnapshot | FBClient.firestore.QuerySnapshot
export type DocumentSnapshot = FBAdmin.firestore.DocumentSnapshot | FBClient.firestore.DocumentSnapshot
export type QueryDocumentSnapshot = FBAdmin.firestore.QueryDocumentSnapshot | FBClient.firestore.QueryDocumentSnapshot
export type Snapshot = QuerySnapshot | DocumentSnapshot
export type DocumentReference = FBAdmin.firestore.DocumentReference | FBClient.firestore.DocumentReference
export type CollectionReference = FBAdmin.firestore.CollectionReference | FBClient.firestore.CollectionReference

export function isQuery(possibleQuery: any): possibleQuery is Query {
  return "where" in possibleQuery
}

export function isQuerySnapshot(possibleQuerySnapshot: Snapshot): possibleQuerySnapshot is QuerySnapshot {
  return "docs" in possibleQuerySnapshot
}

export type ExcludeFunctionKeys<T> = Pick<
  T,
  { [K in keyof T]: T[K] extends CollectionQuery<any> | ((...args: any) => any) ? never : K }[keyof T]
>

export type Props<T> = {
  [K in keyof ExcludeFunctionKeys<T>]: T[K]
}

export type PropsRequired<T, K extends keyof Props<T>> = Partial<Props<T>> & Required<Pick<Props<T>, K>>
export type PropsOptional<T, K extends keyof Props<T>> = Props<T> & Partial<Pick<Props<T>, K>>

export type ProxyWrapper<T, U> = {
  [K in keyof T]: T[K] extends (...a: any) => T
    ? (...a: Parameters<T[K]>) => ProxyWrapper<T, U>
    : T[K]
} & U

export type Unsubscriber = { unsubscribe(): void }