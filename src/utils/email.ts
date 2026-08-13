import net from 'node:net'
import tls from 'node:tls'
import { env } from '../config/env'
import { logger } from './logger'

interface SendEmailInput {
  to: string
  subject: string
  text: string
}

const CRLF = '\r\n'

function smtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
}

function encode(value: string) {
  return Buffer.from(value).toString('base64')
}

function escapeDotLines(value: string) {
  return value.replace(/^\./gm, '..')
}

async function readResponse(socket: net.Socket | tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = ''

    const cleanup = () => {
      socket.off('data', onData)
      socket.off('error', onError)
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split(/\r?\n/).filter(Boolean)
      const lastLine = lines[lines.length - 1]

      if (lastLine && /^\d{3}\s/.test(lastLine)) {
        cleanup()
        resolve(buffer)
      }
    }

    socket.on('data', onData)
    socket.on('error', onError)
  })
}

async function command(socket: net.Socket | tls.TLSSocket, value: string, expected: number[]) {
  socket.write(`${value}${CRLF}`)
  const response = await readResponse(socket)
  const code = Number(response.slice(0, 3))

  if (!expected.includes(code)) {
    throw new Error(`SMTP command failed: ${response.trim()}`)
  }

  return response
}

function connectSocket(): Promise<net.Socket | tls.TLSSocket> {
  const host = env.SMTP_HOST || ''
  const port = Number(env.SMTP_PORT || (env.SMTP_SECURE === 'true' ? 465 : 587))
  const options = {
    host,
    port,
    servername: host,
  }

  return new Promise((resolve, reject) => {
    let socket: net.Socket | tls.TLSSocket

    socket = env.SMTP_SECURE === 'true'
      ? tls.connect(options, () => resolve(socket))
      : net.connect(options, () => resolve(socket))

    socket.once('error', reject)
  })
}

export async function sendEmail(input: SendEmailInput) {
  if (!smtpConfigured()) {
    return {
      sent: false,
      message: 'Email haijatumwa kwa sababu SMTP haijawekwa kwenye environment.',
    }
  }

  let socket = await connectSocket()

  try {
    await readResponse(socket)
    await command(socket, `EHLO ${env.SMTP_HELO_HOST || 'kibali-mafuta.local'}`, [250])

    if (env.SMTP_SECURE !== 'true' && env.SMTP_STARTTLS !== 'false') {
      await command(socket, 'STARTTLS', [220])
      socket = tls.connect({ socket, servername: env.SMTP_HOST })
      await command(socket, `EHLO ${env.SMTP_HELO_HOST || 'kibali-mafuta.local'}`, [250])
    }

    await command(socket, 'AUTH LOGIN', [334])
    await command(socket, encode(env.SMTP_USER || ''), [334])
    await command(socket, encode(env.SMTP_PASS || ''), [235])
    await command(socket, `MAIL FROM:<${env.SMTP_FROM || env.SMTP_USER}>`, [250])
    await command(socket, `RCPT TO:<${input.to}>`, [250, 251])
    await command(socket, 'DATA', [354])

    const from = env.SMTP_FROM || env.SMTP_USER
    const body = [
      `From: Kibali Mafuta <${from}>`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      escapeDotLines(input.text),
      '.',
    ].join(CRLF)

    await command(socket, body, [250])
    await command(socket, 'QUIT', [221])

    return {
      sent: true,
      message: `Credentials zimetumwa kwenda ${input.to}.`,
    }
  } catch (error) {
    logger.error('Failed to send credentials email:', error)
    return {
      sent: false,
      message: 'Mtumiaji amesajiliwa, lakini email ya credentials haikuweza kutumwa.',
    }
  } finally {
    socket.destroy()
  }
}
