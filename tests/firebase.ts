import { initializeApp, getApp } from "firebase/app"
import { getFirestore, useFirestoreEmulator } from "firebase/firestore"

const projectId = process.env.PROJECT_ID

const ignoreError = <T>(fn: (() => T)): T|null => {
  try {
    return fn()
  } catch (_) {
    return null
  }
}

let started = false
export const app = ignoreError(() => getApp() && (started = true) && getApp()) || initializeApp({ projectId })
export const db = getFirestore(app)
if (!started) useFirestoreEmulator(db, "localhost", 8080)
