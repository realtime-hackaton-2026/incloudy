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
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
