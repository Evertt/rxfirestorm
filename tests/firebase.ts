import type FBClient from "firebase"
import type FBAdmin from "firebase-admin"
import * as firebase from "@firebase/testing"

const projectId = process.env.PROJECT_ID

export const clientApp = firebase.initializeTestApp({ projectId })
export const clientDB = clientApp.firestore() as FBClient.firestore.Firestore

export const adminApp = firebase.initializeAdminApp({ projectId })
export const adminDB = adminApp.firestore() as unknown as FBAdmin.firestore.Firestore

export const { serverTimestamp } = firebase.firestore.FieldValue
