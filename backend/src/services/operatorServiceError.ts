export class OperatorServiceError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function isOperatorServiceError(err: unknown): err is OperatorServiceError {
  return err instanceof OperatorServiceError;
}
