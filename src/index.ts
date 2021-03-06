import Model from "./Model"
import { init } from "./common"
import { BelongsTo } from "./relations/BelongsTo"
import { SubCollection } from "./relations/SubCollection"
import type { ModelQuery, ModelStore } from "./ModelQuery"
import type { Props, PropsOptional, PropsRequired } from "./types"
import type { CollectionQuery, CollectionStore } from "./CollectionQuery"

export default Model
export { SubCollection, BelongsTo, init }
export type {
    Props,
    PropsOptional, PropsRequired,
    ModelQuery, ModelStore,
    CollectionQuery, CollectionStore
}
