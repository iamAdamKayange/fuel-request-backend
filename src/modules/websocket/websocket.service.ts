import { Server as WebSocketServer, WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'

interface Client {
  ws: WebSocket
  userId: string
}

export class WebSocketService {
  private static instance: WebSocketService
  private wss: WebSocketServer | null = null
  private clients: Map<string, Client[]> = new Map()

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService()
    }
    return WebSocketService.instance
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: any) {
    this.wss = new WebSocketServer({ server, path: '/ws' })

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      this.handleConnection(ws, req)
    })

    console.log('WebSocket server initialized')
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocket, req: any) {
    try {
      // Extract token from query params
      const url = new URL(req.url, `http://${req.headers.host}`)
      const token = url.searchParams.get('token')

      if (!token) {
        ws.close(1008, 'No token provided')
        return
      }

      // Verify token
      const secret = env.JWT_ACCESS_SECRET?.toString()
      if (!secret) {
        ws.close(1011, 'Server configuration error')
        return
      }

      const decoded = jwt.verify(token, secret) as any
      const userId = decoded.id

      if (!userId) {
        ws.close(1008, 'Invalid token')
        return
      }

      // Add client
      const client: Client = { ws, userId }
      
      if (!this.clients.has(userId)) {
        this.clients.set(userId, [])
      }
      
      this.clients.get(userId)!.push(client)

      console.log(`WebSocket client connected: ${userId}`)

      // Send welcome message
      this.sendToClient(client, {
        type: 'connected',
        message: 'WebSocket connection established',
      })

      // Handle messages from client
      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data)
          this.handleClientMessage(client, message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      })

      // Handle disconnection
      ws.on('close', () => {
        this.handleDisconnection(client)
      })

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        this.handleDisconnection(client)
      })
    } catch (error) {
      console.error('Error handling WebSocket connection:', error)
      ws.close(1011, 'Connection error')
    }
  }

  /**
   * Handle messages from client
   */
  private handleClientMessage(client: Client, message: any) {
    switch (message.type) {
      case 'ping':
        this.sendToClient(client, { type: 'pong' })
        break
      default:
        console.log('Unknown message type:', message.type)
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(client: Client) {
    const userClients = this.clients.get(client.userId)
    
    if (userClients) {
      const index = userClients.findIndex((c) => c.ws === client.ws)
      
      if (index !== -1) {
        userClients.splice(index, 1)
      }

      if (userClients.length === 0) {
        this.clients.delete(client.userId)
      }
    }

    console.log(`WebSocket client disconnected: ${client.userId}`)
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: Client, data: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data))
    }
  }

  /**
   * Send notification to specific user
   */
  sendNotificationToUser(userId: string, notification: any) {
    const userClients = this.clients.get(userId)
    
    if (userClients) {
      userClients.forEach((client) => {
        this.sendToClient(client, {
          type: 'notification',
          data: notification,
        })
      })
    }
  }

  /**
   * Send notification to multiple users
   */
  sendNotificationToUsers(userIds: string[], notification: any) {
    userIds.forEach((userId) => {
      this.sendNotificationToUser(userId, notification)
    })
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(data: any) {
    this.clients.forEach((userClients) => {
      userClients.forEach((client) => {
        this.sendToClient(client, data)
      })
    })
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    let count = 0
    this.clients.forEach((clients) => {
      count += clients.length
    })
    return count
  }

  /**
   * Get connected users list
   */
  getConnectedUsers(): string[] {
    return Array.from(this.clients.keys())
  }
}

export const webSocketService = WebSocketService.getInstance()
