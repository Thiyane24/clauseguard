from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    env: str = "development"
    gemini_api_key: str = ""
    gemini_cloud_model: str = "gemini-3.5-flash"
    firebase_project_id: str = "project2-8e03b"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
