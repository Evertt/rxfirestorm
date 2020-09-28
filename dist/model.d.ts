import "weakref-pollyfill";
import type FBClient from "firebase";
import type FBAdmin from "firebase-admin";
import { Observable } from "rxjs";
export declare function init(firestore: FBAdmin.firestore.Firestore | FBClient.firestore.Firestore, serverTimestampField: () => FBAdmin.firestore.FieldValue | FBClient.firestore.FieldValue): void;
declare type Query = FBAdmin.firestore.Query | FBClient.firestore.Query;
declare type DocumentReference = FBAdmin.firestore.DocumentReference | FBClient.firestore.DocumentReference;
declare type ExcludeFunctionKeys<T> = Pick<T, {
    [K in keyof T]: T[K] extends CollectionQuery<any> | ((...args: any) => any) ? never : K;
}[keyof T]>;
export declare type Props<T> = {
    [K in keyof ExcludeFunctionKeys<T>]: T[K];
};
export declare type PropsRequired<T, K extends keyof Props<T>> = Partial<Props<T>> & Required<Pick<Props<T>, K>>;
export declare type PropsOptional<T, K extends keyof Props<T>> = Props<T> & Partial<Pick<Props<T>, K>>;
declare type ProxyWrapper<T, U> = {
    [K in keyof T]: T[K] extends (...a: any) => T ? (...a: Parameters<T[K]>) => ProxyWrapper<T, U> : T[K];
} & U;
declare type Unsubscriber = {
    unsubscribe(): void;
};
export declare type CollectionStore<M extends Model> = Promise<M[]> & Observable<M[]> & Unsubscriber;
export declare type ModelStore<M extends Model> = Promise<M> & Observable<M> & Unsubscriber & {
    id: string;
};
export declare type CollectionQuery<ModelType extends typeof Model> = ProxyWrapper<Query, CollectionQueryMethods<ModelType>>;
export declare type ModelQuery<ModelType extends typeof Model> = ProxyWrapper<Query, ModelQueryMethods<ModelType>>;
declare type ModelQueryMethods<ModelType extends typeof Model> = ModelStore<InstanceType<ModelType>>;
declare type CollectionQueryMethods<ModelType extends typeof Model> = CollectionStore<InstanceType<ModelType>> & {
    first(): ModelQueryMethods<ModelType>;
    add(model: ConstructorParameters<ModelType>[0]): Promise<void>;
};
export default class Model {
    static collection: string;
    docRef?: DocumentReference;
    id?: string;
    createdAt: Date;
    updatedAt?: Date;
    constructor(init: any);
    static query<T extends typeof Model>(this: T): CollectionQuery<T>;
    static find<T extends typeof Model>(this: T, id: string): ModelQuery<T>;
    save(updateOrReplace?: "update" | "replace"): Promise<void>;
    updateOrCreate(): Promise<void>;
    delete(): Promise<void>;
    toJSON<T extends typeof Model>(): Props<InstanceType<T>>;
}
export declare const subcollection: <ModelType extends typeof Model>(SubModelClass: ModelType) => <Target extends Model & Record<Key, ProxyWrapper<Query, CollectionQueryMethods<ModelType>>>, Key extends string | symbol>(target: Target, key: Key) => void;
export declare const belongsTo: <ModelType extends typeof Model>(SubModelClass: ModelType) => <Target extends Model & Record<Key, ProxyWrapper<Query, ModelStore<InstanceType<ModelType>>>>, Key extends string | symbol>(target: Target, key: Key) => void;
export {};
