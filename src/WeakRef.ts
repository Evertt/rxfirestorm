interface WeakRef {
  new <T extends Object>(object: T): {
    deref(): T|undefined
  }
}

const WeakRef: WeakRef = (globalThis as any).WeakRef || class<T extends Object> {
  static map = new WeakMap()

  constructor(object: T) {
    (this.constructor as any).map.set(this, object)
  }

  deref(): T {
    return (this.constructor as any).map.get(this)
  }
}

export default WeakRef
