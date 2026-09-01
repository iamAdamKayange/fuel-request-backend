import { AuthService } from '../../modules/auth/auth.service'

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    authService = AuthService.getInstance()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AuthService.getInstance()
      const instance2 = AuthService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('getMe', () => {
    it('should throw error for non-existent user', async () => {
      await expect(authService.getMe('non-existent-id')).rejects.toThrow('User not found')
    })
  })

  describe('login', () => {
    it('should throw error for invalid credentials', async () => {
      await expect(
        authService.login('nonexistent@example.com', 'wrongpassword', {} as any)
      ).rejects.toThrow('Invalid credentials')
    })
  })

  describe('refreshToken', () => {
    it('should throw error for invalid refresh token', async () => {
      await expect(
        authService.refreshToken('invalid-refresh-token')
      ).rejects.toThrow('Invalid refresh token')
    })
  })
})