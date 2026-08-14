import {
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app'

import {
  getMessaging,
  type Messaging,
} from 'firebase-admin/messaging'

import { env } from './env'

let firebaseAdminInstance: App | null = null
let fcmInstance: Messaging | null = null

const projectId = env.FIREBASE_PROJECT_ID?.trim()
const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim()
const privateKey = env.FIREBASE_PRIVATE_KEY?.trim()

const hasFirebaseCredentials =
  Boolean(projectId) &&
  Boolean(clientEmail) &&
  Boolean(privateKey)

if (hasFirebaseCredentials) {
  try {
    const existingApps = getApps()

    if (existingApps.length > 0) {
      firebaseAdminInstance = existingApps[0]
    } else {
      firebaseAdminInstance = initializeApp({
        credential: cert({
          projectId: projectId!,
          clientEmail: clientEmail!,
          privateKey: privateKey!.replace(/\\n/g, '\n'),
        }),
      })
    }

    fcmInstance = getMessaging(firebaseAdminInstance)

    console.log('🔥 Firebase Admin initialized successfully')
    console.log(`🔥 Firebase project: ${projectId}`)
  } catch (error) {
    firebaseAdminInstance = null
    fcmInstance = null

    console.error('❌ Firebase initialization failed:')

    if (error instanceof Error) {
      console.error(error.message)
      console.error(error.stack)
    } else {
      console.error(error)
    }
  }
} else {
  console.warn(
    '⚠️ Firebase credentials are missing. Push notifications are disabled.'
  )

  console.warn(
    'Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
  )
}

export {
  firebaseAdminInstance as firebaseAdmin,
  fcmInstance as fcm,
}