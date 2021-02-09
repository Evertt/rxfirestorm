import type FBClient from "firebase"
import type FBAdmin from "firebase-admin"
import * as firebase from "@firebase/testing"

const projectId = process.env.PROJECT_ID

export const clientApp = firebase.initializeTestApp({ projectId }) as unknown as FBClient.app.App
export const clientDB = clientApp.firestore()

export const adminApp = firebase.initializeAdminApp({ projectId }) as unknown as FBAdmin.app.App
export const adminDB = adminApp.firestore()

export const { serverTimestamp } = firebase.firestore.FieldValue
