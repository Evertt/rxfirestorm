import User from "./User"
import Model, { belongsTo, ModelQuery } from "../../src/model"

export default class Comment extends Model {
  static collection = "comments"

  @belongsTo(User)
  public author: ModelQuery<typeof User>
  public body: string

  constructor(init: { body: string, author: User }) {
    super(init)

    this.body = init.body
    this.author = init.author as any
  }
}
