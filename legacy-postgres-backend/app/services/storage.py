"""Storage abstraction so image uploads can move from local disk (MVP) to an
S3-compatible bucket later without touching any API endpoint code."""
import abc
import os
import uuid

from fastapi import UploadFile

from app.core.config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE_MB = 8


class StorageProvider(abc.ABC):
    @abc.abstractmethod
    def save(self, file: UploadFile, subfolder: str) -> str:
        """Persist the file and return a publicly reachable URL."""
        raise NotImplementedError


class LocalStorageProvider(StorageProvider):
    def save(self, file: UploadFile, subfolder: str) -> str:
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {ext or 'unknown'}")

        contents = file.file.read()
        if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise ValueError(f"File too large (max {MAX_FILE_SIZE_MB}MB)")

        target_dir = os.path.join(settings.UPLOAD_DIR, subfolder)
        os.makedirs(target_dir, exist_ok=True)
        filename = f"{uuid.uuid4().hex}{ext}"
        path = os.path.join(target_dir, filename)
        with open(path, "wb") as f:
            f.write(contents)

        return f"{settings.UPLOAD_BASE_URL}/{subfolder}/{filename}"


class S3StorageProvider(StorageProvider):
    """Placeholder for production use. Not wired up in the MVP — flip
    STORAGE_PROVIDER=s3 and fill in S3_* env vars once boto3 is added."""

    def save(self, file: UploadFile, subfolder: str) -> str:
        raise NotImplementedError(
            "S3 storage is not configured yet. Set STORAGE_PROVIDER=local, or implement "
            "S3StorageProvider with boto3 and the S3_* settings."
        )


def get_storage_provider() -> StorageProvider:
    if settings.STORAGE_PROVIDER == "s3":
        return S3StorageProvider()
    return LocalStorageProvider()
