import { Request, Response, NextFunction } from 'express'
import { ZodTypeAny, ZodError } from 'zod'
import { errorResponse } from '../utils/response'

export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        // Use error.issues (v3+) instead of error.errors
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))

        res.status(400).json(
          errorResponse('Validation error', errors)
        )
        return
      }
      next(error)
    }
  }
}