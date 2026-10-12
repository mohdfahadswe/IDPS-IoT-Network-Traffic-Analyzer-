import os
import json
from datetime import datetime, timezone
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_score, recall_score, f1_score

from ml.datasets.ciciot2023_dataset_loader import load_ciciot2023_dataset
from ml.datasets.generate_ciciot2023 import CICIOT2023_ATTACK_TAXONOMY

FEATURES = [
    "traffic_volume",
    "packet_count",
    "request_frequency",
    "connection_frequency",
    "failed_connections",
    "protocol_num",
    "destination_port",
    "event_rate",
    "historical_alerts_count"
]

TARGET = "is_suspicious"

def train_and_save_model(data_path: str = None, model_output_path: str = None, metadata_output_path: str = None):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    if not data_path:
        data_path = os.path.join(base_dir, "datasets", "ciciot2023_dataset.csv")
    if not model_output_path:
        model_output_path = os.path.join(base_dir, "models", "rf_iot_model.joblib")
    if not metadata_output_path:
        metadata_output_path = os.path.join(base_dir, "models", "model_metadata.json")

    # Load or generate CICIoT2023 dataset
    df = load_ciciot2023_dataset(custom_kaggle_csv=data_path if os.path.exists(data_path) else None, num_samples=15000)

    X = df[FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    print(f"Training Random Forest on CICIoT2023 benchmark ({len(df):,} samples, 33 attack classes)...")
    rf = RandomForestClassifier(
        n_estimators=120,
        max_depth=14,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    rf.fit(X_train, y_train)

    y_pred = rf.predict(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred))
    rec = float(recall_score(y_test, y_pred))
    f1 = float(f1_score(y_test, y_pred))
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"--- CICIoT2023 Model Evaluation Results ---")
    print(f"Accuracy:  {acc:.4f}")
    print(f"Precision: {prec:.4f}")
    print(f"Recall:    {rec:.4f}")
    print(f"F1 Score:  {f1:.4f}")
    print(f"Confusion Matrix:\n{cm}")
    print(classification_report(y_test, y_pred, target_names=["Benign", "Suspicious"]))

    feature_importances = {
        feat: round(float(imp), 4)
        for feat, imp in zip(FEATURES, rf.feature_importances_)
    }

    os.makedirs(os.path.dirname(model_output_path), exist_ok=True)
    joblib.dump(rf, model_output_path)
    print(f"Model saved to {model_output_path}")

    # Breakdown by category if present
    category_breakdown = {}
    if "attack_category" in df.columns:
        category_breakdown = df["attack_category"].value_counts().to_dict()

    metadata = {
        "model_name": "RandomForest_CICIoT2023_Classifier",
        "algorithm": "RandomForestClassifier",
        "dataset": "CICIoT2023 (Kaggle Benchmark Dataset)",
        "dataset_source": "Kaggle / Canadian Institute for Cybersecurity (CIC)",
        "features": FEATURES,
        "classes": ["Benign", "Suspicious"],
        "attack_categories": list(CICIOT2023_ATTACK_TAXONOMY.keys()),
        "attack_types_count": 33,
        "attack_distribution": category_breakdown,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "samples_count": len(df),
        "metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "confusion_matrix": cm
        },
        "feature_importances": feature_importances
    }

    os.makedirs(os.path.dirname(metadata_output_path), exist_ok=True)
    with open(metadata_output_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"CICIoT2023 Model Metadata saved to {metadata_output_path}")

    return rf, metadata

if __name__ == "__main__":
    train_and_save_model()

