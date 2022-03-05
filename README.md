# RxFireSTORM

This combines Firestore with an ORM and RxJS.

### Simple example

```typescript
// models.ts
import Model from "rxfirestorm"

export class Article extends Model {
  static collection = "articles"

  public title: string
  public body: string

  constructor(init: { title?: string, body?: string }) {
    super(init)
    this.title = init.title ?? ""
    this.body = init.body ?? ""
  }
}
```

And then somewhere you could do this:

```typescript
import { Article } from "../models"

const article$ = Article.query().where("title", "==", "Hello World!").first()

// If you want to listen to snapshots, you can subscribe to it
// like you're used to with Observables from RxJS
const subscription = article$.subscribe(
  article => console.log(article.body)
)

// Or if you just want a single data object, you can await it.
const article = await article$
// This will subscribe to it, wait for the first snapshot, and then unsubscribe.
```

Or in a Svelte component you'd write it like this of course:

```typescript
import { Article } from "../models"

const article = Article.query().first()

$: console.log($article.body)
```

### More complex example

```typescript
// models.ts
import Model, {
  HasMany,
  BelongsTo,
  ModelQuery,
  CollectionQuery
} from "rxfirestorm"

export class User extends Model {
  static collection = "users"

  public email = ""
  public name = ""

  constructor(init: { email?: string, name?: string }) {
    super(init)
    Object.assign(this, init)
  }
}

export class Comment extends Model {
  static collection = "comments"

  public body: string

  @BelongsTo(User)
  public author!: ModelQuery<typeof User>

  constructor(init: { body: string, author: User }) {
    super(init)
    Object.assign(this, init)
  }
}

export class Article extends Model {
  static collection = "articles"

  public title = ""
  public body = ""

  @BelongsTo(User) public author!: ModelQuery<typeof User>
  @HasMany(Comment) public comments!: CollectionQuery<typeof Comment>

  constructor(init: { title?: string, body?: string, author: User }) {
    super(init)
    Object.assign(this, init)
  }

  async addComment(comment: { body: string, author: User }): Promise<void> {
    await this.comments.add(comment)
  }
}
```

And then somewhere else:

```typescript
const article = await Article.query().first()

console.log(article.author.name) // will print a name

let comments = await article.comments // lazy loading
// you can also add arbitrary query constraints
comments = await article.comments.orderBy("createdAt")

comments.forEach(comment => console.log(comment.body))
```

Check out the tests for more examples!
