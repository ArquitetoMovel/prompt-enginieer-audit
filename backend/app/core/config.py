from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Prompt Engineer Audit"
    API_V1_STR: str = "/api/v1"
    
    # GitHub Integration
    GITHUB_TOKEN: str
    
    # MCP Configuration
    MCP_SERVER_URL: str = "http://localhost:8000/mcp"
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379"
    
    # OpenAI/Anthropic API Keys
    # OpenAI/Anthropic API Keys
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

settings = Settings()
