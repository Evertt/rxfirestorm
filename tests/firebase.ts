import { initializeApp } from "firebase/app"
import { getFirestore, useFirestoreEmulator } from "firebase/firestore"

const projectId = process.env.PROJECT_ID

export const app = initializeApp({ projectId })
export const db = getFirestore(app)
useFirestoreEmulator(db, "localhost", 8080)
