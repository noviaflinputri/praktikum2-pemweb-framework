import { Request, Response } from 'express';
import { TodoModel } from '../models/todoModel';
import type { CreateTodoRequest, UpdateTodoRequest, TodoResponse, TodoRow } from '../types/todo';
import type { PaginationMeta } from '../types/common';
import { sendSuccess, sendSuccessPagination, sendError } from '../utils/response';

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Helper internal untuk mengekstrak userId secara fleksibel dari berbagai bentuk payload JWT
const getUserId = (req: Request, res: Response): number => {
  const user = (req as any).user || res.locals.user;

  // Cek log terminal backend untuk debugging jika diperlukan
  if (process.env.NODE_ENV !== 'production') {
    console.log('[DEBUG] Data user dari Auth Token:', user);
  }

  const id =
    user?.id ||
    user?.userId ||
    user?.user_id ||
    user?.sub ||
    (req as any).userId;

  return Number(id) || 0;
};

export const getTodos = async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req, res);
  const page = parsePositiveInt(req.query.page, 1);
  const perPage = Math.min(parsePositiveInt(req.query.perPage, 10), 50);
  const offset = (page - 1) * perPage;

  try {
    const [todos, total] = await Promise.all([
      TodoModel.getByUserId(userId, perPage, offset),
      TodoModel.countByUserId(userId),
    ]);

    const data: TodoResponse[] = (todos as TodoRow[]).map(({ id, task, is_completed }) => ({
      id,
      todo: task,
      completed: Boolean(is_completed),
    }));

    const pagination: PaginationMeta = {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage) || 1,
    };

    sendSuccessPagination(res, 'Berhasil!', data, pagination);
  } catch (error: any) {
    console.error('Error getTodos:', error);
    sendError(res, error.message || 'Gagal mengambil data.', 500);
  }
};

export const getTodoById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = getUserId(req, res);

  try {
    const todo = await TodoModel.getById(Number(id), userId);

    if (!todo) {
      sendError(res, 'Tugas tidak ditemukan!', 404);
      return;
    }

    const row = todo as TodoRow;
    const data: TodoResponse = {
      id: row.id,
      todo: row.task,
      completed: Boolean(row.is_completed),
    };

    sendSuccess(res, 'Berhasil!', data);
  } catch (error: any) {
    console.error('Error getTodoById:', error);
    sendError(res, error.message || 'Gagal mengambil data.', 500);
  }
};

export const createTodo = async (req: Request, res: Response): Promise<void> => {
  const payload: CreateTodoRequest = req.body;
  const userId = getUserId(req, res);

  // Mencegah query ke MySQL jika ID user bernilai 0/invalid agar tidak memicu Foreign Key Fail
  if (!userId) {
    sendError(
      res,
      'Sesi otentikasi tidak ditemukan atau telah kadaluarsa. Silakan Logout dan Login kembali!',
      401
    );
    return;
  }

  const taskText = payload.task?.trim();

  if (!taskText) {
    sendError(res, 'Task wajib diisi!', 400);
    return;
  }

  try {
    const newId = await TodoModel.create(userId, taskText);

    const data: TodoResponse = {
      id: newId,
      todo: taskText,
      completed: false,
    };

    sendSuccess(res, 'Tugas berhasil ditambahkan!', data, 201);
  } catch (error: any) {
    console.error('Error createTodo Detail:', error);
    sendError(res, error.message || 'Gagal menambahkan tugas.', 500);
  }
};

export const updateTodo = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const payload: UpdateTodoRequest = req.body;
  const userId = getUserId(req, res);

  if (!userId) {
    sendError(res, 'Sesi otentikasi tidak valid! Silakan Login kembali.', 401);
    return;
  }

  try {
    const affectedRows = await TodoModel.update(
      Number(id),
      payload.task,
      payload.is_completed,
      userId
    );

    if (affectedRows === 0) {
      sendError(res, 'Tugas tidak ditemukan!', 404);
      return;
    }

    sendSuccess(res, 'Tugas berhasil diperbarui!');
  } catch (error: any) {
    console.error('Error updateTodo:', error);
    sendError(res, error.message || 'Gagal memperbarui tugas.', 500);
  }
};

export const deleteTodo = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = getUserId(req, res);

  if (!userId) {
    sendError(res, 'Sesi otentikasi tidak valid! Silakan Login kembali.', 401);
    return;
  }

  try {
    const affectedRows = await TodoModel.delete(Number(id), userId);

    if (affectedRows === 0) {
      sendError(res, 'Tugas tidak ditemukan!', 404);
      return;
    }

    sendSuccess(res, 'Tugas berhasil dihapus!');
  } catch (error: any) {
    console.error('Error deleteTodo:', error);
    sendError(res, error.message || 'Gagal menghapus tugas.', 500);
  }
};