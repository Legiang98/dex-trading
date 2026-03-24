import { HTTP } from "../constants/http";

export class AppError extends Error {
    public statusCode: number;
    public message: string;

    constructor(message: string, statusCode: number = HTTP.INTERNAL_SERVER_ERROR) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.message = message;
        Error.captureStackTrace(this, this.constructor);
    }
}
