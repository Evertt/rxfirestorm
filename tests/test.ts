import fetch from "node-fetch"
import { expect } from "chai"
import User from "./models/User"
import Article from "./models/Article"
import { init } from "../src/model"
import { clientDB, serverTimestamp } from "./firebase"
import firebaseConfig from "../firebase.json"

init(clientDB, serverTimestamp)

describe("CRUD", () => {
  it("successfully saves and fetches model", async () => {
    const newUser = new User({
      email: "john@example.com",
      name: "John Doe"
    })

    await newUser.save()
    const fetchedUser = await User.query().first()

    expect(fetchedUser.name).to.equal(newUser.name)
  })

  it("fetches a belongs-to relationship", async () => {
    const user = new User({
      email: "john@example.com",
      name: "John Doe"
    })

    const newArticle = new Article({
      title: "My first article",
      body: "With some text",
      author: user
    })

    const newAuthor = await newArticle.author
    expect(newAuthor.name).to.equal(user.name)

    await newArticle.save()
    const fetchedArticle = await Article.query().first()
    const fetchedAuthor = await fetchedArticle.author

    expect(fetchedAuthor.name).to.equal(newAuthor.name)
  })
})

const port = firebaseConfig.emulators.firestore.port
const id = process.env.PROJECT_ID

after(fetch.bind(
  null,
  `http://localhost:${port}/emulator/v1/projects/${id}/databases/(default)/documents`,
  { method: "DELETE" }
))
