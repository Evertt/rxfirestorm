import { init } from "../src"
import { expect } from "chai"
import fetch from "node-fetch"
import User from "./models/User"
import Article from "./models/Article"
import firebaseConfig from "../firebase.json"
import { clientDB, serverTimestamp } from "./firebase"

init(clientDB, serverTimestamp)

const userData = {
  email: "john@example.com",
  name: "John Doe",
}

const articleData = {
  title: "My first article",
  body: "With some text",
}

describe("CRUD", () => {
  it("successfully saves and fetches model", async () => {
    const newUser = new User(userData)

    await newUser.save()
    const fetchedUser = await User.query().first()

    expect(fetchedUser.name).to.equal(newUser.name)
  })

  it("automatically saves a related model", async () => {
    const author = new User(userData)
    const article = new Article({ ...articleData, author })

    await article.save()
    const fetchedUser = await User.query().first()

    expect(fetchedUser.name).to.equal(author.name)
  })

  it("fetches a belongs-to relationship", async () => {
    const author = new User(userData)
    const newArticle = new Article({ ...articleData, author })

    const newAuthor = await newArticle.author
    expect(newAuthor.name).to.equal(author.name)

    await newArticle.save()
    const fetchedArticle = await Article.query().first()
    const fetchedAuthor = await fetchedArticle.author

    expect(fetchedAuthor.name).to.equal(newAuthor.name)
  })

  it("saves and fetches a subcollection", async () => {
    const author = new User(userData)
    const article = new Article({ ...articleData, author })

    await article.save()
    await article.addComment({ body: "First", author })
    await article.addComment({ body: "Second", author })

    const comments = await article.comments.orderBy("createdAt", "asc")

    expect(comments.length).to.equal(2)
    expect(comments[0].body).to.equal("First")

    const { name } = Object.getPrototypeOf(comments[0].constructor)
    expect(name).to.equal("Comment")
  })
})

const port = firebaseConfig.emulators.firestore.port
const id = process.env.PROJECT_ID

after(fetch.bind(
  null,
  `http://localhost:${port}/emulator/v1/projects/${id}/databases/(default)/documents`,
  { method: "DELETE" }
))
