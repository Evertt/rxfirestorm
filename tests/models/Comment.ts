import User from "./User"
import Model, { BelongsTo, ModelQuery } from "../../src"

export default class Comment extends Model {
  static collection = "comments"

  @BelongsTo(User)
  public author: ModelQuery<typeof User>
  public body: string

  constructor(init: { body: string, author: User }) {
    super(init)

    this.body = init.body
    this.author = init.author as any
  }
}
