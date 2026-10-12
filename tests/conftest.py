import pytest
from backend.app.database.connection import Base, engine, SessionLocal
from backend.app.database.seed import seed_database
from backend.app.ml.model_service import ModelService

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    # 1. Initialize DB tables
    Base.metadata.create_all(bind=engine)
    
    # 2. Seed default admin, initial devices, domains, settings
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    # 3. Ensure RF model loaded
    ModelService.get_instance()
