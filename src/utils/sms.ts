import { env } from '../config/env'
import { decrypt } from './encryption'

/**
 * Send SMS notification
 * This is a placeholder implementation that can be integrated with SMS providers
 * like Twilio, Africa's Talking, or other SMS gateways
 */
export async function sendSMS(options: {
  to: string
  message: string
}): Promise<boolean> {
  try {
    // Check if SMS is configured
    if (!env.SMS_API_KEY || !env.SMS_API_URL) {
      console.log('SMS not configured. Skipping SMS notification.')
      return false
    }

    // Decrypt phone number if it's encrypted
    let phoneNumber = options.to
    try {
      phoneNumber = decrypt(options.to)
    } catch (error) {
      // If decryption fails, assume it's not encrypted
      phoneNumber = options.to
    }

    // Placeholder for SMS API integration
    // Example with a generic SMS API:
    /*
    const response = await fetch(env.SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SMS_API_KEY}`,
      },
      body: JSON.stringify({
        to: phoneNumber,
        message: options.message,
        sender: env.SMS_SENDER_ID || 'FuelPermit',
      }),
    })

    const result = await response.json()
    return result.success === true
    */

    console.log(`SMS would be sent to ${phoneNumber}: ${options.message}`)
    return true
  } catch (error) {
    console.error('Failed to send SMS:', error)
    return false
  }
}

/**
 * Send fuel request SMS notification
 */
export async function sendFuelRequestSMS(
  phoneNumber: string,
  requestNumber: string,
  status: string,
  action: string
): Promise<boolean> {
  const message = `Fuel Request ${requestNumber} - ${action}. Status: ${status}. Please check the system for details.`
  
  return sendSMS({
    to: phoneNumber,
    message,
  })
}

/**
 * Send approval SMS notification to approver
 */
export async function sendApprovalSMS(
  phoneNumber: string,
  requestNumber: string,
  requesterName: string,
  approvalStage: string
): Promise<boolean> {
  const message = `Fuel Request ${requestNumber} from ${requesterName} requires your ${approvalStage} approval. Please check the system.`
  
  return sendSMS({
    to: phoneNumber,
    message,
  })
}

/**
 * Send account locked SMS notification
 */
export async function sendAccountLockedSMS(phoneNumber: string): Promise<boolean> {
  const message = `Your account has been locked due to too many failed login attempts. Please contact the administrator.`
  
  return sendSMS({
    to: phoneNumber,
    message,
  })
}

/**
 * Check if SMS service is configured
 */
export function isSMSConfigured(): boolean {
  return !!(env.SMS_API_KEY && env.SMS_API_URL)
}
