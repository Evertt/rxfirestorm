import Comment from "./Comment"
import User from "./User"
import Model, {
  BelongsTo,
  SubCollection,
  ModelQuery,
  CollectionQuery,
} from "../../src"

export default class Article extends Model {
  static collection = "articles"

  public title = ""
  public body = ""

  @BelongsTo(User) public author: ModelQuery<typeof User>
  @SubCollection(Comment) public comments!: CollectionQuery<typeof Comment>

  constructor(init: { title?: string, body?: string, author: User }) {
    super(init)
    Object.assign(this, init)
    this.author = init.author as any
  }

  async addComment(comment: { body: string, author: User }): Promise<void> {
    await this.comments.add(comment)
  }
}
