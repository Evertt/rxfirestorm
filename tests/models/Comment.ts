import type { DocumentReference } from "firebase/firestore"
import { Article, User } from "./index"
import { doc } from "firebase/firestore"
import Model, { BelongsTo, ModelQuery } from "../../src"

export default class Comment extends Model {
  static collection = "comments"

  @BelongsTo(User)
  public author!: ModelQuery<typeof User>

  @BelongsTo(() => Article)
  public article!: ModelQuery<typeof Article>

  public body: string = ""

  public get title(): string {
    return "My title"
  }

  constructor(init: { body: string, author: User }) {
    super(init)
    Object.assign(this, init)
  }

  sayHi() {
    return "Hi!"
  }
}
