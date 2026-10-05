export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(msg = 'Bad request', details?: unknown) {
    return new AppError(400, msg, details);
  }
  static unauthorized(msg = 'Authentication required') {
    return new AppError(401, msg);
  }
  static forbidden(msg = 'You do not have permission to perform this action') {
    return new AppError(403, msg);
  }
  static notFound(msg = 'Resource not found') {
    return new AppError(404, msg);
  }
  static conflict(msg = 'Conflict', details?: unknown) {
    return new AppError(409, msg, details);
  }
}
