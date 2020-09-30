interface WeakRef {
  new <T extends Object>(object: T): {
    deref(): T|undefined
  }
}

const WeakRef: WeakRef = getGlobal().WeakRef || class<T extends Object> {
  static map = new WeakMap()

  constructor(object: T) {
    (this.constructor as any).map.set(this, object)
  }

  deref(): T {
    return (this.constructor as any).map.get(this)
  }
}

export default WeakRef

function getGlobal(): any {
  switch (true) {
		case typeof globalThis === 'object' && !!globalThis:
			return globalThis
		case typeof self === 'object' && !!self:
			return self
		case typeof window === 'object' && !!window:
			return window
		case typeof global === 'object' && !!global:
			return global
		case typeof Function === 'function':
      return (Function('return this')())
    default:
      return {}
	}
}
