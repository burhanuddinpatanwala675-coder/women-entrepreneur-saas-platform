from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg2://hercommerce:hercommerce_dev_pw@localhost:5432/hercommerce"

    JWT_SECRET_KEY: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    UPLOAD_DIR: str = "./uploads"
    UPLOAD_BASE_URL: str = "http://localhost:8000/uploads"

    CORS_ORIGINS: str = "http://localhost:5173"

    AI_PROVIDER: str = "none"
    AI_API_KEY: str = ""

    STORAGE_PROVIDER: str = "local"
    S3_BUCKET: str = ""
    S3_REGION: str = ""
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""

    PLATFORM_NAME: str = "HerCommerce"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
