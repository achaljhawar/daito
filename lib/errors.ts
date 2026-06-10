/**
 * @fileoverview Custom error types.
 * All custom errors extend DomainError for consistent handling.
 */

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

/** Missing or invalid environment configuration. */
export class ConfigurationError extends DomainError {
  readonly code = "CONFIGURATION_ERROR";
  readonly isOperational = false;

  constructor(message: string, cause?: Error) {
    super(message, 500, cause);
  }
}

/** Upstream API failure (screener.in, Morningstar). */
export class APIError extends DomainError {
  readonly code = "API_ERROR";
  readonly isOperational = true;

  constructor(
    message: string,
    public readonly service: string,
    statusCode = 500,
    cause?: Error
  ) {
    super(message, statusCode, cause);
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      service: this.service,
    };
  }
}
