import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "NetPulse IoT Security Platform"
    API_PREFIX: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database: SQLite fallback, PostgreSQL compatible
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./netpulse.db")
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "netpulse-super-secret-security-token-key-2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Automated Response Thresholds
    AUTO_RESPONSE_ENABLED: bool = True
    HIGH_RISK_THRESHOLD: int = 61      # >= 61 triggers Auto Temporary Block
    CRITICAL_RISK_THRESHOLD: int = 81  # >= 81 triggers Auto Permanent Block
    DEFAULT_TEMP_BLOCK_MINUTES: int = 15
    
    # Demo User
    DEMO_USER_EMAIL: str = "admin@example.com"
    DEMO_USER_PASSWORD: str = "Admin@123"
    DEMO_USER_NAME: str = "Security Administrator"

settings = Settings()
