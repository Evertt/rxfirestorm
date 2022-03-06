import { Comment, User } from "./index"
import Model, {
  BelongsTo,
  HasMany,
  ModelQuery,
  CollectionQuery,
  SubCollection,
} from "../../src"

export default class Article extends Model {
  static collection = "articles"

  public title = ""
  public body = ""

  @BelongsTo(User)
  public author!: ModelQuery<typeof User>

  @HasMany(Comment, "article")
  public comments!: CollectionQuery<typeof Comment>

  @SubCollection(Comment)
  public subComments!: CollectionQuery<typeof Comment>

  constructor(init: { title?: string, body?: string, author: User }) {
    super(init)
    Object.assign(this, init)
  }
}
