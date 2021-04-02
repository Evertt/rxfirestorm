import type { Props } from "./types"
import type { DocumentReference } from "firebase/firestore"

import { db } from "./common"
import { difference } from "./utils"
import { metadata } from "./relations/common"
import { modelQuery, ModelQuery } from "./ModelQuery"
import { collectionQuery, CollectionQuery } from "./CollectionQuery"
import { collection, doc, deleteDoc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore"

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
    const data = this.toJSON({ exclude: ["id", "createdAt", "updatedAt"] } as any) as any

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
        || doc(collection(db(), (this.constructor as any).collection), this.id)
      const document = await getDoc(this.docRef)

      if (document.exists() && updateOrReplace === "update") {
        const diff = difference(data, document.data())

        Object.keys(diff).forEach(key => {
          if (diff[key] === undefined) {
            delete diff[key]
          }
        })

        if (Object.keys(diff).length) {
          diff.updatedAt = serverTimestamp()
          await updateDoc(this.docRef, diff)
        }

        Object.assign(this, (await getDoc(this.docRef)).data())
      } else {
        data.createdAt = this.createdAt
        data.updatedAt = serverTimestamp()
        await setDoc(this.docRef, data)
      }
    } else {
      const document = doc(collection(db(), (this.constructor as any).collection))
      await setDoc(document, { ...data, createdAt: serverTimestamp(), updatedAt: null })
      this.docRef = document
      this.id = document.id
    }
  }

  async updateOrCreate(): Promise<void> {
    await this.save("update")
  }

  async delete(): Promise<void> {
    this.docRef && await deleteDoc(this.docRef)
  }

  toJSON<T extends Array<keyof Props<this>>>(args: { exclude: T }): Omit<Props<this>, T[number]>
  toJSON<T extends Array<keyof Props<this>>>(args: { include: T }): Pick<Props<this>, T[number]>
  toJSON<T extends Array<keyof Props<this>>>(args: { exclude: T } | { include: T }): Omit<Props<this>, T[number]> | Pick<Props<this>, T[number]> {
    let data: any

    if ("include" in args) {
      for (const key of args.include) {
        data[key] = this[key]
      }
    }

    if ("exclude" in args) {
      data = { ...this }

      for (const key of args.exclude) {
        delete data[key]
      }
    }

    delete data.docRef

    return data
  }
}
