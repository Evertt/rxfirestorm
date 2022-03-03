import type { DocumentReference } from "firebase/firestore"
import type Article from "./Article"
import User from "./User"
import { doc } from "firebase/firestore"
import Model, { BelongsTo, ModelQuery } from "../../src"

export default class Comment extends Model {
  static collection = "comments"

  @BelongsTo(User)
  public author!: ModelQuery<typeof User>

  public article!: DocumentReference<Article>

  public body: string = ""

  constructor(init: { body: string, author: User }) {
    super(init)
    Object.assign(this, init)
  }
}
