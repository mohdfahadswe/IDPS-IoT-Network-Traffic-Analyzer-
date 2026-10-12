import os
import logging
import pandas as pd
from typing import Optional

from ml.datasets.generate_ciciot2023 import generate_ciciot2023_dataset, CICIOT2023_ATTACK_TAXONOMY

logger = logging.getLogger(__name__)

def load_ciciot2023_dataset(
    custom_kaggle_csv: Optional[str] = None,
    num_samples: int = 15000,
    force_regenerate: bool = False
) -> pd.DataFrame:
    """
    Loads or generates the CICIoT2023 dataset for NetPulse IoT security models.
    Supports direct ingestion of Kaggle CICIoT2023 CSV downloads or generates
    the calibrated CICIoT2023 benchmark dataset.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_csv_path = os.path.join(base_dir, "datasets", "ciciot2023_dataset.csv")

    # 1. Custom Kaggle CSV provided
    if custom_kaggle_csv and os.path.exists(custom_kaggle_csv):
        print(f"Loading custom Kaggle CICIoT2023 dataset from: {custom_kaggle_csv}")
        df = pd.read_csv(custom_kaggle_csv)
        return df

    # 2. Existing standard dataset
    if os.path.exists(default_csv_path) and not force_regenerate:
        print(f"Loading cached CICIoT2023 dataset from: {default_csv_path}")
        df = pd.read_csv(default_csv_path)
        return df

    # 3. Generate benchmark dataset
    print(f"Generating CICIoT2023 benchmark dataset ({num_samples} samples) with 33 attack classes...")
    df = generate_ciciot2023_dataset(num_samples=num_samples, output_path=default_csv_path)
    return df
