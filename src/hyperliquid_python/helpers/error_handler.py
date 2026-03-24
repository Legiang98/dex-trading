from constants.http import HTTP

class AppError(Exception):
    def __init__(self, message: str, status_code: int = HTTP.INTERNAL_SERVER_ERROR):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
