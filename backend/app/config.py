from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017/incloudy"
    mongodb_db: str = "incloudy"
    jwt_secret: str = Field(min_length=32)
    jwt_expire_minutes: int = 1440
    jwt_algorithm: str = "HS256"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    gemini_fallback_models: str = "gemini-3.5-flash-lite,gemini-3.1-flash-lite"
    portal_secret_key: str = ""
    portal_publishable_key: str = ""
    portal_api_url: str = "https://api.useportal.co"
    portal_token_ttl: str = "1h"
    portal_webhook_secret: str = ""
    invitation_expire_hours: int = 72
    data_retention_days: int = 30
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
