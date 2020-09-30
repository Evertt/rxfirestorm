import { BehaviorSubject } from "rxjs"

const mode = process.env.NODE_ENV
const dev = mode === "development"

export const subscriptionCounts = new BehaviorSubject<{ [key: string]: number }>({})
export const snapshotCounts = new BehaviorSubject<{ [key: string]: number }>({})

// This is here for debug purposes.
// You know, when you get a memory leak.
if (dev) {
  if (typeof window !== "undefined") {
    snapshotCounts.subscribe(counts => {
      (window as any).snapshotCounts = counts
    })
  }

  subscriptionCounts.subscribe(counts => {
    if (typeof window !== "undefined") {
      (window as any).snapshotCounts = counts
    } else {
      console.log(counts)
    }
  })
}