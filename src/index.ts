import type {
    Props,
    PropsOptional, PropsRequired,
    ModelQuery, ModelStore,
    CollectionQuery, CollectionStore
} from "./model"
import Model, { subcollection, belongsTo, init } from "./model"

export default Model
export { subcollection, belongsTo, init }
export type {
    Props,
    PropsOptional, PropsRequired,
    ModelQuery, ModelStore,
    CollectionQuery, CollectionStore
}
