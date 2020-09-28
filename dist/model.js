var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import "weakref-pollyfill";
import { difference } from "./utils";
import { Observable, Subject, BehaviorSubject, firstValueFrom } from "rxjs";
import { startWith, takeUntil, take, refCount, publishReplay } from "rxjs/operators";
const mode = process.env.NODE_ENV;
const dev = mode === "development";
let db;
let serverTimestamp;
export function init(firestore, serverTimestampField) {
    db = firestore;
    serverTimestamp = serverTimestampField;
}
function isQuery(possibleQuery) {
    return "where" in possibleQuery;
}
function isQuerySnapshot(possibleQuerySnapshot) {
    return "docs" in possibleQuerySnapshot;
}
const metadata = new Map();
const subs = [];
function makeProxy(customMethods, cb, query, ModelClass) {
    return new Proxy(customMethods, {
        get(target, prop, receiver) {
            // If the requested prop is in our custom methods thingy,
            // then that takes precedent.
            if (prop in target) {
                return Reflect.get(target, prop, receiver);
            }
            // Otherwise we take a look into the query object we have
            const queryProp = Reflect.get(query, prop, receiver);
            // If the requested prop is indeed a function on the query object
            if (typeof queryProp === "function") {
                // Then we return a slightly altered version of that function.
                return (...args) => {
                    // Which forwards the call to the function on the query object.
                    const queryMethod = queryProp.bind(query);
                    const result = queryMethod(...args);
                    // And then checks if the result is another query object.
                    if (isQuery(result)) {
                        // If it is, then wrap that in another Collection type
                        return cb(ModelClass, result);
                    }
                    // If not, then just return the result transparently.
                    return result;
                };
            }
            // If queryFunc anything other than a function,
            // then just return that without wrapping it.
            return queryProp;
        },
    });
}
const extend = (observable, unsubscriber) => {
    const combined = observable
        .pipe(publishReplay(1), refCount())
        .pipe(unsubscriber && typeof window !== "undefined" ? takeUntil(unsubscriber) : take(1));
    combined.then = (onFulfilled, onRejected) => firstValueFrom(combined).then(onFulfilled, onRejected);
    combined.catch = onRejected => firstValueFrom(combined).catch(onRejected);
    combined.finally = onFinally => firstValueFrom(combined).finally(onFinally);
    combined.unsubscribe = () => {
        unsubscriber === null || unsubscriber === void 0 ? void 0 : unsubscriber.next();
        unsubscriber === null || unsubscriber === void 0 ? void 0 : unsubscriber.complete();
    };
    return combined;
};
function initModel(ModelClass, doc) {
    const data = doc.data();
    for (const key in data) {
        if (data[key] && typeof data[key] === "object" && "toDate" in data[key]) {
            data[key] = data[key].toDate();
        }
    }
    return new ModelClass(Object.assign({ id: doc.id, docRef: doc.ref }, data));
}
const subscriptionCounts = new BehaviorSubject({});
const snapshotCounts = new BehaviorSubject({});
// This is here for debug purposes.
// You know, when you get a memory leak.
if (dev) {
    if (typeof window !== "undefined") {
        snapshotCounts.subscribe(counts => {
            window.snapshotCounts = counts;
        });
    }
    subscriptionCounts.subscribe(counts => {
        if (typeof window !== "undefined") {
            window.snapshotCounts = counts;
        }
        else {
            console.log(counts);
        }
    });
}
function queryToString(query) {
    const possibleKeys = ["_query", "_queryOptions", "jd"];
    for (const key of possibleKeys) {
        if (key in query) {
            return JSON.stringify(query[key]);
        }
    }
    throw Error("Query in query could not be found");
}
const queryStoreCache = new Map();
function docQuery(ModelClass, queryOrId = db.collection(ModelClass.collection)) {
    const query = typeof queryOrId === "string"
        ? db.collection(ModelClass.collection).doc(queryOrId)
        : queryOrId;
    if (query.limit === undefined) {
        query.limit = () => query;
    }
    const unsubscriber = new Subject();
    const myCustomMethods = extend((new Observable(subscriber => {
        const { name } = ModelClass;
        const unsubscribe = query.limit(1).onSnapshot((snapshot) => {
            if (snapshot.empty === true || snapshot.exists === false) {
                subscriber.error(new Error(`${ModelClass.name} not found.`));
            }
            else {
                const doc = (isQuerySnapshot(snapshot) ? snapshot.docs[0] : snapshot);
                snapshotCounts.next(Object.assign(Object.assign({}, snapshotCounts.value), { [doc.ref.path]: (snapshotCounts.value[doc.ref.path] || 0) + 1 }));
                const model = initModel(ModelClass, doc);
                subscriber.next(model);
            }
        });
        subscriptionCounts.next(Object.assign(Object.assign({}, subscriptionCounts.value), { [name]: (subscriptionCounts.value[name] || 0) + 1 }));
        return () => {
            unsubscribe();
            subscriptionCounts.next(Object.assign(Object.assign({}, subscriptionCounts.value), { [name]: (subscriptionCounts.value[name] || 0) - 1 }));
        };
    })), unsubscriber);
    // Then we create a proxy
    const proxy = makeProxy(myCustomMethods, docQuery, query, ModelClass);
    const key = typeof queryOrId === "string"
        ? `${ModelClass.collection}/${queryOrId}`
        : queryToString(query.limit(1));
    const cachedQueryStore = queryStoreCache.get(key);
    if (cachedQueryStore && cachedQueryStore.deref()) {
        return cachedQueryStore.deref();
    }
    queryStoreCache.set(key, new WeakRef(proxy));
    return proxy;
}
function colQuery(ModelClass, query = db.collection(ModelClass.collection)) {
    const unsubscriber = new Subject();
    const myCustomMethods = extend((new Observable(subscriber => {
        const unsubscribe = query.onSnapshot(snapshot => subscriber.next(snapshot.docs.map(doc => initModel(ModelClass, doc))));
        const { name } = ModelClass;
        subscriptionCounts.next(Object.assign(Object.assign({}, subscriptionCounts.value), { [name]: (subscriptionCounts.value[name] || 0) + 1 }));
        return () => {
            unsubscribe();
            subscriptionCounts.next(Object.assign(Object.assign({}, subscriptionCounts.value), { [name]: (subscriptionCounts.value[name] || 0) - 1 }));
        };
    })), unsubscriber);
    myCustomMethods.first = () => docQuery(ModelClass, query);
    myCustomMethods.add = (model) => __awaiter(this, void 0, void 0, function* () {
        const _a = model, { id: {}, docRef: {} } = _a, rest = __rest(_a, ["id", "docRef"]);
        const modelClass = new ModelClass(rest);
        yield modelClass.save();
    });
    // Then we create a proxy
    const proxy = makeProxy(myCustomMethods, colQuery, query, ModelClass);
    const key = queryToString(query);
    const cachedQueryStore = queryStoreCache.get(key);
    if (cachedQueryStore && cachedQueryStore.deref()) {
        return cachedQueryStore.deref();
    }
    queryStoreCache.set(key, new WeakRef(proxy));
    return proxy;
}
export default class Model {
    constructor(init) {
        var _a;
        this.docRef = init.docRef;
        this.id = ((_a = this.docRef) === null || _a === void 0 ? void 0 : _a.id) || init.id;
        if (!init.createdAt) {
            this.createdAt = new Date();
        }
        else if (typeof init.createdAt === "string") {
            this.createdAt = new Date(init.createdAt);
        }
        else if ("toDate" in init.createdAt) {
            this.createdAt = init.createdAt.toDate();
        }
        else {
            this.createdAt = init.createdAt;
        }
        if (!init.updatedAt)
            return;
        if (typeof init.updatedAt === "string") {
            this.updatedAt = new Date(init.updatedAt);
        }
        else if ("toDate" in init.updatedAt) {
            this.updatedAt = init.updatedAt.toDate();
        }
        else {
            this.updatedAt = init.updatedAt;
        }
    }
    static query() {
        return colQuery(this);
    }
    static find(id) {
        return docQuery(this, id);
    }
    save(updateOrReplace = "replace") {
        return __awaiter(this, void 0, void 0, function* () {
            const data = Object.assign({}, this);
            delete data.id;
            delete data.docRef;
            delete data.createdAt;
            delete data.updatedAt;
            yield Promise.all(Object.keys(data).map((key) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                if (data[key] == null)
                    return;
                if (((_a = data[key].constructor) === null || _a === void 0 ? void 0 : _a.name) === "Observable") {
                    delete data[key];
                }
            })));
            const md = metadata.get(this) || {};
            yield Promise.all(Object.keys(md).map((key) => __awaiter(this, void 0, void 0, function* () {
                if (key === "id" || !md[key])
                    return;
                if ("then" in md[key]) {
                    const model = yield md[key];
                    if (model.docRef == null)
                        yield model.save();
                    data[key] = model.docRef;
                }
            })));
            if (this.id) {
                this.docRef = this.docRef
                    || db.collection(this.constructor.collection).doc(this.id);
                const doc = yield this.docRef.get();
                if (doc.exists && updateOrReplace === "update") {
                    const diff = difference(data, doc.data());
                    Object.keys(diff).forEach(key => {
                        if (diff[key] === undefined) {
                            delete diff[key];
                        }
                    });
                    if (Object.keys(diff).length) {
                        diff.updatedAt = serverTimestamp();
                        yield this.docRef.update(diff);
                    }
                    Object.assign(this, (yield this.docRef.get()).data());
                }
                else {
                    data.createdAt = this.createdAt;
                    data.updatedAt = serverTimestamp();
                    yield this.docRef.set(data);
                }
            }
            else {
                const doc = db.collection(this.constructor.collection).doc();
                yield doc.set(Object.assign(Object.assign({}, data), { createdAt: serverTimestamp(), updatedAt: null }));
                this.docRef = doc;
                this.id = doc.id;
            }
        });
    }
    updateOrCreate() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.save("update");
        });
    }
    delete() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            yield ((_a = this.docRef) === null || _a === void 0 ? void 0 : _a.delete());
        });
    }
    toJSON() {
        const _a = this, { docRef } = _a, rest = __rest(_a, ["docRef"]);
        return rest;
    }
}
Model.collection = "";
const addSubscription = (model, fn) => {
    function get() {
        var _a;
        return (_a = metadata.get(this)) === null || _a === void 0 ? void 0 : _a.id;
    }
    function set(id) {
        metadata.set(this, { id });
        subs.forEach((cb) => cb(this, id));
    }
    if (Object.getOwnPropertyDescriptor(model, "id") === undefined) {
        Object.defineProperty(model, "id", { get, set });
    }
    subs.push(fn);
};
export const subcollection = (SubModelClass) => (target, key) => {
    const setNewQuery = (t, id) => {
        var _a;
        const collectionPath = target.constructor.collection;
        const newClass = (_a = class extends SubModelClass {
            },
            _a.collection = `${collectionPath}/${id}/${key}`,
            _a);
        t[key] = newClass.query();
    };
    addSubscription(target, setNewQuery);
};
export const belongsTo = (SubModelClass) => (target, key) => {
    function get() {
        const md = metadata.get(this) || {};
        return md[key];
    }
    function set(newValue) {
        let query;
        if (!newValue) {
        }
        else if (typeof newValue === "string") {
            query = newValue;
        }
        else if (newValue.docRef != null) {
            query = newValue.docRef.id;
        }
        else if (newValue.id != null) {
            query = newValue.id;
        }
        else {
            newValue = extend(new Observable().pipe(startWith(newValue)));
        }
        metadata.set(this, Object.assign(Object.assign({}, metadata.get(this)), { [key]: query ? docQuery(SubModelClass, query) : newValue }));
    }
    Object.defineProperty(target, key, { get, set });
};
//# sourceMappingURL=model.js.map