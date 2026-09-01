import nodemailer from 'nodemailer'
import { env } from '../config/env'

let transporter: nodemailer.Transporter | null = null

/**
 * Get email transporter (lazy initialization)
 */
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      throw new Error('SMTP configuration is incomplete')
    }

    const config: any = {
      host: env.SMTP_HOST,
      port: parseInt(env.SMTP_PORT || '587'),
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    }

    if (env.SMTP_SECURE === 'true') {
      config.secure = true
    }

    if (env.SMTP_STARTTLS === 'true') {
      config.tls = {
        rejectUnauthorized: false,
      }
    }

    if (env.SMTP_HELO_HOST) {
      config.heloIdentity = env.SMTP_HELO_HOST
    }

    transporter = nodemailer.createTransport(config)
  }

  return transporter
}

/**
 * Send email
 */
export async function sendEmail(options: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<boolean> {
  try {
    const transporter = getTransporter()

    const mailOptions = {
      from: env.SMTP_FROM || 'noreply@mafuta.go.tz',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

/**
 * Send fuel request notification
 */
export async function sendFuelRequestNotification(
  recipientEmail: string,
  recipientName: string,
  requestNumber: string,
  status: string,
  action: string
): Promise<boolean> {
  const subject = `Fuel Request ${requestNumber} - ${action}`
  
  const text = `
Dear ${recipientName},

Your fuel request (${requestNumber}) has been ${action}.

Status: ${status}

Please log in to the system for more details.

Best regards,
Fuel Permit Management System
  `.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .status { font-weight: bold; color: #2563eb; }
    .footer { margin-top: 20px; padding: 10px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Fuel Request Notification</h2>
    </div>
    <div class="content">
      <p>Dear ${recipientName},</p>
      <p>Your fuel request (<strong>${requestNumber}</strong>) has been <span class="status">${action}</span>.</p>
      <p><strong>Status:</strong> ${status}</p>
      <p>Please log in to the system for more details.</p>
    </div>
    <div class="footer">
      <p>Fuel Permit Management System</p>
    </div>
  </div>
</body>
</html>
  `.trim()

  return sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  })
}

/**
 * Send approval notification to approver
 */
export async function sendApprovalNotification(
  recipientEmail: string,
  recipientName: string,
  requestNumber: string,
  requesterName: string,
  approvalStage: string
): Promise<boolean> {
  const subject = `Fuel Request ${requestNumber} - Pending ${approvalStage} Approval`
  
  const text = `
Dear ${recipientName},

A fuel request (${requestNumber}) from ${requesterName} is pending your ${approvalStage} approval.

Please log in to the system to review and approve/reject this request.

Best regards,
Fuel Permit Management System
  `.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .stage { font-weight: bold; color: #dc2626; }
    .footer { margin-top: 20px; padding: 10px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Pending Approval Notification</h2>
    </div>
    <div class="content">
      <p>Dear ${recipientName},</p>
      <p>A fuel request (<strong>${requestNumber}</strong>) from <strong>${requesterName}</strong> is pending your <span class="stage">${approvalStage}</span> approval.</p>
      <p>Please log in to the system to review and approve/reject this request.</p>
    </div>
    <div class="footer">
      <p>Fuel Permit Management System</p>
    </div>
  </div>
</body>
</html>
  `.trim()

  return sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  })
}

/**
 * Send account locked notification
 */
export async function sendAccountLockedNotification(
  recipientEmail: string,
  recipientName: string
): Promise<boolean> {
  const subject = 'Account Locked - Too Many Failed Login Attempts'
  
  const text = `
Dear ${recipientName},

Your account has been locked due to too many failed login attempts.

For security reasons, please contact the administrator to unlock your account.

Best regards,
Fuel Permit Management System
  `.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .warning { font-weight: bold; color: #dc2626; }
    .footer { margin-top: 20px; padding: 10px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Account Locked</h2>
    </div>
    <div class="content">
      <p>Dear ${recipientName},</p>
      <p>Your account has been <span class="warning">locked</span> due to too many failed login attempts.</p>
      <p>For security reasons, please contact the administrator to unlock your account.</p>
    </div>
    <div class="footer">
      <p>Fuel Permit Management System</p>
    </div>
  </div>
</body>
</html>
  `.trim()

  return sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  })
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
}
