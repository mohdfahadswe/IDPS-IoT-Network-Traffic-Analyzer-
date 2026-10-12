import pytest
from backend.app.ml.model_service import ModelService
from backend.app.ml.risk_engine import risk_engine

def test_rf_model_service_prediction_normal():
    service = ModelService.get_instance()
    normal_features = {
        "traffic_volume": 320,
        "packet_count": 4,
        "request_frequency": 0.1,
        "connection_frequency": 2.0,
        "failed_connections": 0,
        "protocol_num": 6,
        "destination_port": 80,
        "event_rate": 2.0,
        "historical_alerts_count": 0
    }
    is_suspicious, confidence, reasons = service.predict(normal_features)
    assert isinstance(is_suspicious, bool)
    assert 0.0 <= confidence <= 1.0
    # Normal telemetry should not trigger high suspicious confidence
    assert confidence < 0.70

def test_rf_model_service_prediction_suspicious():
    service = ModelService.get_instance()
    malicious_features = {
        "traffic_volume": 120000,
        "packet_count": 850,
        "request_frequency": 45.0,
        "connection_frequency": 120.0,
        "failed_connections": 18,
        "protocol_num": 6,
        "destination_port": 22,
        "event_rate": 180.0,
        "historical_alerts_count": 4
    }
    is_suspicious, confidence, reasons = service.predict(malicious_features)
    assert is_suspicious is True
    assert confidence >= 0.50
    assert len(reasons) > 0

def test_risk_scoring_engine():
    # Test normal score
    score, level, reasons = risk_engine.calculate_risk(
        rf_is_suspicious=False,
        rf_confidence=0.05,
        features={"traffic_volume": 300, "request_frequency": 0.1, "failed_connections": 0}
    )
    assert score <= 30.0
    assert level == "Low"

    # Test high / critical risk score
    score_crit, level_crit, reasons_crit = risk_engine.calculate_risk(
        rf_is_suspicious=True,
        rf_confidence=0.92,
        features={"traffic_volume": 150000, "request_frequency": 80.0, "failed_connections": 20},
        domain_risk=85.0
    )
    assert score_crit >= 80.0
    assert level_crit in ["High", "Critical"]
    assert len(reasons_crit) >= 2
