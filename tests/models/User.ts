import Model, { Props } from "../../src"

export default class User extends Model {
  static collection = "users"

  public email = ""
  public name = ""

  constructor(init: Partial<Props<User>>) {
    super(init)
    Object.assign(this, init)
  }
}
