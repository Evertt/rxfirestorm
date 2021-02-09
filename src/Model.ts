import { metadata } from "./relations/common"
import { db, serverTimestamp } from "./common"
import { difference } from "./utils"
import type FBAdmin from "firebase-admin"
import { modelQuery, ModelQuery } from "./ModelQuery"
import { collectionQuery, CollectionQuery } from "./CollectionQuery"
import type { Props, DocumentReference } from "./types"

export default class Model {
  static collection = ""

  public docRef?: DocumentReference
  public id?: string
  public createdAt: Date
  public updatedAt?: Date

  constructor(init: any) {
    this.docRef = init.docRef
    this.id = this.docRef?.id || init.id

    if (!init.createdAt) {
      this.createdAt = new Date()
    } else if (typeof init.createdAt === "string") {
      this.createdAt = new Date(init.createdAt)
    } else if ("toDate" in init.createdAt) {
      this.createdAt = init.createdAt.toDate()
    } else {
      this.createdAt = init.createdAt
    }

    if (!init.updatedAt) return
    if (typeof init.updatedAt === "string") {
      this.updatedAt = new Date(init.updatedAt)
    } else if ("toDate" in init.updatedAt) {
      this.updatedAt = init.updatedAt.toDate()
    } else {
      this.updatedAt = init.updatedAt
    }
  }

  static query<T extends typeof Model>(this: T): CollectionQuery<T> {
    return collectionQuery(this as any)
  }

  static find<T extends typeof Model>(this: T, id: string): ModelQuery<T> {
    return modelQuery(this as any, id)
  }

  async save(updateOrReplace: "update"|"replace" = "replace"): Promise<void> {
    const data: any = { ...this }

    delete data.id
    delete data.docRef
    delete data.createdAt
    delete data.updatedAt

    await Promise.all(Object.keys(data).map(async key => {
      if (data[key] == null) return

      if (typeof data[key] === "object" && "subscribe" in data[key]) {
        delete data[key]
      }
    }))

    const md = metadata.get(this) || {}

    await Promise.all(Object.keys(md).map(async key => {
      if (key === "id" || !md[key]) return

      if ("then" in md[key]) {
        const model = await md[key]
        if (model.docRef == null) await model.save()
        data[key] = model.docRef
      }
    }))

    if (this.id) {
      this.docRef = this.docRef
        || db().collection((this.constructor as any).collection).doc(this.id) as DocumentReference
      const doc = await this.docRef.get()

      if (doc.exists && updateOrReplace === "update") {
        const diff = difference(data, doc.data())

        Object.keys(diff).forEach(key => {
          if (diff[key] === undefined) {
            delete diff[key]
          }
        })

        if (Object.keys(diff).length) {
          diff.updatedAt = serverTimestamp()()
          await this.docRef.update(diff)
        }

        Object.assign(this, (await this.docRef.get()).data())
      } else {
        data.createdAt = this.createdAt
        data.updatedAt = serverTimestamp()()
        await this.docRef.set(data)
      }
    } else {
      const doc = db().collection((this.constructor as any).collection).doc()
      await doc.set({ ...data, createdAt: serverTimestamp()(), updatedAt: null })
      this.docRef = doc as FBAdmin.firestore.DocumentReference
      this.id = doc.id
    }
  }

  async updateOrCreate(): Promise<void> {
    await this.save("update")
  }

  async delete(): Promise<void> {
    await this.docRef?.delete()
  }

  toJSON<T extends typeof Model>(): Props<InstanceType<T>> {
    let rest = Object.assign({}, this)
    delete rest.docRef

    return rest as unknown as Props<InstanceType<T>>
  }
}

