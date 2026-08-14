import * as admin from 'firebase-admin'
import { env } from './env'

// Firebase Admin SDK
const firebaseAdmin = admin as any

let firebaseAdminInstance: any = null
let fcmInstance: any = null

// Read Firebase environment variables safely
const projectId = env.FIREBASE_PROJECT_ID?.trim()
const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim()
const privateKey = env.FIREBASE_PRIVATE_KEY

// Check whether all Firebase credentials exist
const hasFirebaseCredentials =
  Boolean(projectId) &&
  Boolean(clientEmail) &&
  Boolean(privateKey)

if (hasFirebaseCredentials) {
  try {
    // Prevent initializing Firebase more than once
    if (!firebaseAdmin.apps.length) {
      // Render/environment variables may contain literal \n
      // Convert them into real new lines.
      const formattedPrivateKey = privateKey!.replace(/\\n/g, '\n')

      const credential = firebaseAdmin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      })

      firebaseAdmin.initializeApp({
        credential,
      })

      console.log('🔥 Firebase initialized successfully')
    } else {
      console.log('🔥 Firebase app already initialized')
    }

    // Firebase Admin instance
    firebaseAdminInstance = firebaseAdmin

    // Firebase Cloud Messaging
    fcmInstance = firebaseAdmin.messaging()

    console.log('🔥 Firebase Cloud Messaging ready')
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error)

    // Disable Firebase safely if initialization fails
    firebaseAdminInstance = null
    fcmInstance = null
  }
} else {
  // Show only which variables are missing.
  // NEVER print the private key.
  const missing: string[] = []

  if (!projectId) {
    missing.push('FIREBASE_PROJECT_ID')
  }

  if (!clientEmail) {
    missing.push('FIREBASE_CLIENT_EMAIL')
  }

  if (!privateKey) {
    missing.push('FIREBASE_PRIVATE_KEY')
  }

  console.warn(
    `⚠️ Firebase credentials missing: ${missing.join(', ')}`
  )

  console.warn(
    '⚠️ Firebase Cloud Messaging is disabled.'
  )
}

// Export Firebase Admin and FCM
export {
  firebaseAdminInstance as firebaseAdmin,
  fcmInstance as fcm,
}