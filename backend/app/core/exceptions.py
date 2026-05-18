from fastapi import HTTPException, status


class FileNotUploadedError(HTTPException):
    def __init__(self, slot: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File slot '{slot}' has not been uploaded yet.",
        )


class ReconcileError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        )
