import type { Props } from "./types"

import { db } from "./common"
import { v4 as uuidv4 } from "uuid"
import { difference } from "./utils"
import { metadata } from "./relations/common"
import { modelQuery, ModelQuery } from "./ModelQuery"
import { collectionQuery, CollectionQuery } from "./CollectionQuery"
import { collection, doc, deleteDoc, serverTimestamp, runTransaction } from "firebase/firestore"

const getDocRef = (model: Model) =>
  doc(collection(db(), (model.constructor as any).collection), model.id)

export default class Model {
  static collection = ""

  public id: string
  public createdAt: Date
  public updatedAt?: Date

  constructor(init: any) {
    this.id = init.id || uuidv4()

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

    Object.keys(data).map(key => {
      if (data[key] == null) return

      if (typeof data[key] === "object" && "subscribe" in data[key]) {
        delete data[key]
      }
    })

    const md = metadata.get(this) || {}

    await Promise.all(Object.keys(md).map(async key => {
      if (key === "id" || !md[key]) return

      if ("then" in md[key]) {
        const model = await md[key]
        await model.save("update")
        data[key] = getDocRef(model)
      }
    }))

    const docRef = getDocRef(this)
    const result = await runTransaction(db(), async transaction => {
      const document = await transaction.get(docRef)
      
      if (!document.exists()) {
        transaction.set(docRef, {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: null
        })

        return { ...data, createdAt: new Date() }
      }
  
      if (updateOrReplace === "replace") {
        data.createdAt = this.createdAt
        data.updatedAt = serverTimestamp()
        transaction.set(docRef, data)
        return { ...data, updatedAt: new Date() }
      }
  
      const diff = difference(data, document.data())
  
      Object.keys(diff).forEach(key => {
        if (diff[key] === undefined) {
          delete diff[key]
        }
      })
  
      if (Object.keys(diff).length) {
        diff.updatedAt = serverTimestamp()
        transaction.update(docRef, diff)
      }
  
      return { ...diff, updatedAt: new Date() }
    })

    Object.assign(this, result)
  }

  async updateOrCreate(): Promise<void> {
    return this.save("update")
  }

  async delete(): Promise<void> {
    return deleteDoc(getDocRef(this)).catch(() => {})
  }

  toJSON<T extends Array<keyof Props<this>>>(args: { exclude: T }): Omit<Props<this>, T[number]>
  toJSON<T extends Array<keyof Props<this>>>(args: { include: T }): Pick<Props<this>, T[number]>
  toJSON<T extends Array<keyof Props<this>>>(args: { exclude: T } | { include: T }): Omit<Props<this>, T[number]> | Pick<Props<this>, T[number]> {
    let data: any = {}

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

    return data
  }
}
