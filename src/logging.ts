import { BehaviorSubject } from "rxjs"

const mode = process.env.NODE_ENV
const dev = mode === "development"

const subscriptionCounts = new BehaviorSubject<{ [key: string]: number }>({})
const snapshotCounts = new BehaviorSubject<{ [key: string]: number }>({})

export const countSubscription = (name: string, n = 1) =>
  subscriptionCounts.next({
    ...subscriptionCounts.value,
    [name]: (subscriptionCounts.value[name] || 0) + n,
  })

export const countSnapshot = (name: string, n = 1) =>
  snapshotCounts.next({
    ...snapshotCounts.value,
    [name]: (snapshotCounts.value[name] || 0) + n,
  })

// This is here for debug purposes.
// It helps to gain insight of potential memory leaks.
if (dev) {
  if (typeof window !== "undefined") {
    snapshotCounts.subscribe(counts => {
      (window as any).snapshotCounts = counts
    })
  }

  subscriptionCounts.subscribe(counts => {
    if (typeof window !== "undefined") {
      (window as any).subscriptionCounts = counts
    } else {
      console.log(counts)
    }
  })
}