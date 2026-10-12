import os
import json
import logging
import joblib
from typing import Tuple, List, Dict, Any

from backend.app.ml.feature_extractor import to_model_input_array

logger = logging.getLogger(__name__)

class ModelService:
    _instance = None
    _model = None
    _metadata = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.load_or_train_model()

    def get_model_path(self) -> str:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        # project-root/ml/models/rf_iot_model.joblib
        return os.path.join(base_dir, "..", "ml", "models", "rf_iot_model.joblib")

    def get_metadata_path(self) -> str:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        return os.path.join(base_dir, "..", "ml", "models", "model_metadata.json")

    def load_or_train_model(self):
        model_path = os.path.abspath(self.get_model_path())
        metadata_path = os.path.abspath(self.get_metadata_path())

        if not os.path.exists(model_path):
            logger.warning(f"Random Forest model not found at {model_path}. Auto-training fallback triggered...")
            try:
                from ml.training.train_model import train_and_save_model
                self._model, self._metadata = train_and_save_model(
                    model_output_path=model_path,
                    metadata_output_path=metadata_path
                )
                logger.info("Random Forest model successfully auto-trained and saved.")
                return
            except Exception as e:
                logger.error(f"Failed to auto-train model: {e}")
                raise RuntimeError(f"Could not load or train Random Forest model: {e}")

        logger.info(f"Loading Random Forest model from {model_path}...")
        self._model = joblib.load(model_path)
        if os.path.exists(metadata_path):
            with open(metadata_path, "r") as f:
                self._metadata = json.load(f)

    def predict(self, features: Dict[str, Any]) -> Tuple[bool, float, List[str]]:
        """
        Classifies event features using Random Forest.
        Returns:
            is_suspicious (bool): True if classified as Suspicious
            confidence (float): Probability score (0.0 - 1.0)
            explainable_reasons (List[str]): Interpretable reasons for the prediction
        """
        if self._model is None:
            self.load_or_train_model()

        X = to_model_input_array(features)
        prediction = self._model.predict(X)[0]
        probabilities = self._model.predict_proba(X)[0]
        
        # Class 1 corresponds to Suspicious
        suspicious_prob = float(probabilities[1]) if len(probabilities) > 1 else float(prediction)
        is_suspicious = bool(prediction == 1 or suspicious_prob >= 0.50)

        # Generate understandable reasons
        reasons = []
        if features.get("traffic_volume", 0) > 10000:
            reasons.append(f"Abnormally high traffic volume ({features['traffic_volume']:,} bytes)")
        if features.get("packet_count", 0) > 150:
            reasons.append(f"Elevated packet burst ({features['packet_count']} packets)")
        if features.get("request_frequency", 0) > 5.0:
            reasons.append(f"High request frequency ({features['request_frequency']} req/sec)")
        if features.get("failed_connections", 0) >= 3:
            reasons.append(f"Multiple failed connection attempts ({features['failed_connections']} failures)")
        if features.get("destination_port") in [21, 22, 23, 135, 445, 1433, 3306, 3389, 4444, 6667, 9001]:
            reasons.append(f"Suspicious destination port targeted (Port {features['destination_port']})")
        if features.get("historical_alerts_count", 0) >= 3:
            reasons.append(f"Device has repeated prior alerts ({features['historical_alerts_count']} recorded)")

        if is_suspicious and not reasons:
            reasons.append("Random Forest identified non-linear statistical deviation in telemetry")

        return is_suspicious, suspicious_prob, reasons

    def get_metadata(self) -> Dict[str, Any]:
        return self._metadata or {}
