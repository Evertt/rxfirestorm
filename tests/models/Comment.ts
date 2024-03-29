import { Article, User } from "./index"
import Model, { BelongsTo, ModelQuery } from "../../src"

export default class Comment extends Model {
  static collection = "comments"

  @BelongsTo(User)
  public author!: ModelQuery<typeof User>

  // The arrow function here is to prevent
  // problems with circular referencing...
  @BelongsTo(() => Article)
  public article!: ModelQuery<typeof Article>

  public body: string = ""

  constructor(init: { body: string, author: User }) {
    super(init)
    Object.assign(this, init)
  }
}
