import { init } from "../src"
import { expect } from "chai"
import fetch from "node-fetch"
import User from "./models/User"
import Article from "./models/Article"
import firebaseConfig from "../firebase.json"
import { db } from "./firebase"

init(db)

const userData = {
  email: "john@example.com",
  name: "John Doe",
}

const articleData = {
  title: "My first article",
  body: "With some text",
}

const sleep = (ms: number) =>
  new Promise(r => setTimeout(r, ms))

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

  it("returns an empty array when a subcollection is non-existent", async () => {
    const author = new User(userData)
    const article = new Article({ ...articleData, author })

    await article.save()

    const comments = await article.comments

    expect(comments).to.be.an("array")
    expect(comments.length).to.equal(0)
  })

  it("can handle subcollections of non-existent root models before saving", async () => {
    const author = new User(userData)
    const article = new Article({ ...articleData, author })

    await article.addComment({ body: "Firsttt", author })
    const comments = await article.comments

    expect(comments).to.be.an("array")
    expect(comments.length).to.equal(1)
    expect(comments[0].body).to.equal("Firsttt")
  })

  it("can save multiple edits in one batch", async () => {
    const newUser = new User(userData)
    await newUser.save()

    const userQuery = User.query().first()
    let fetchedUser = await userQuery
    expect(fetchedUser.name).to.equal(newUser.name)

    newUser.name = "Jane Doe"
    userQuery.set(newUser)

    newUser.email = "jane@doe.com"
    userQuery.set(newUser)

    fetchedUser = await User.query().first()
    expect(fetchedUser.name).to.equal(newUser.name)
    expect(fetchedUser.email).to.equal(newUser.email)
  })

  // it("can handle subcollections of non-existent root models after saving", async () => {
  //   const author = new User(userData)
  //   const article = new Article({ ...articleData, author })

  //   await article.addComment({ body: "Firsttt", author })
  //   await article.save()
  //   const comments = await article.comments

  //   expect(comments).to.be.an("array")
  //   expect(comments.length).to.equal(1)
  //   expect(comments[0].body).to.equal("Firsttt")
  // })
})

const port = firebaseConfig.emulators.firestore.port
const id = process.env.PROJECT_ID

before(fetch.bind(
  null,
  `http://localhost:${port}/emulator/v1/projects/${id}/databases/(default)/documents`,
  { method: "DELETE" }
))
