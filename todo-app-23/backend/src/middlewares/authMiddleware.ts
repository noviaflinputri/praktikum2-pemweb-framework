import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtUserPayload } from '../types/auth';
import { sendError } from '../utils/response';

export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    sendError(res, 'Akses ditolak. Token tidak ditemukan!', 401);
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtUserPayload;

    res.locals.userId = decoded.id;
    next();
  } catch (error) {
    sendError(res, 'Sesi tidak valid atau kedaluwarsa!', 403);
  }
};