import * as admin from 'firebase-admin'
import { env } from './env'

// Use type assertion to bypass TypeScript issues
const firebaseAdmin = admin as any

// Initialize Firebase only if credentials are provided
let firebaseAdminInstance: any = null
let fcmInstance: any = null

const hasFirebaseCredentials = 
  env.FIREBASE_PROJECT_ID && 
  env.FIREBASE_CLIENT_EMAIL && 
  env.FIREBASE_PRIVATE_KEY

if (hasFirebaseCredentials) {
  try {
    if (!firebaseAdmin.apps.length) {
      const credential = firebaseAdmin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      })

      firebaseAdmin.initializeApp({
        credential,
      })
      console.log('🔥 Firebase initialized successfully')
    }
    firebaseAdminInstance = firebaseAdmin
    fcmInstance = firebaseAdmin.messaging()
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error)
  }
} else {
  console.warn('⚠️ Firebase credentials not provided. Push notifications disabled.')
}

export { firebaseAdminInstance as firebaseAdmin, fcmInstance as fcm }