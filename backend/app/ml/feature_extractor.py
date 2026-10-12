from typing import Dict, Any, List
import pandas as pd

PROTOCOLS = {
    "TCP": 6,
    "UDP": 17,
    "ICMP": 1,
    "HTTP": 6,
    "MQTT": 6,
    "COAP": 17
}

FEATURE_ORDER = [
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

def extract_features_from_event(
    event_data: Dict[str, Any],
    historical_alerts_count: int = 0,
    recent_events_count_in_min: int = 2
) -> Dict[str, Any]:
    """
    Extracts and standardizes 9 network/telemetry features for the Random Forest model.
    """
    traffic_volume = event_data.get("traffic_volume")
    if traffic_volume is None:
        sensor_data = event_data.get("sensor_data") or {}
        traffic_volume = max(128, len(str(sensor_data).encode("utf-8")) + 220)

    packet_count = event_data.get("packet_count")
    if packet_count is None:
        packet_count = max(2, int(traffic_volume // 150))

    request_frequency = event_data.get("request_frequency")
    if request_frequency is None:
        request_frequency = 0.1

    connection_frequency = event_data.get("connection_frequency")
    if connection_frequency is None:
        connection_frequency = 2.0

    failed_connections = int(event_data.get("failed_connections") or 0)

    protocol_str = str(event_data.get("protocol") or "TCP").upper()
    protocol_num = PROTOCOLS.get(protocol_str, 6)

    destination_port = int(event_data.get("destination_port") or 80)
    event_rate = float(recent_events_count_in_min or 1.0)
    hist_alerts = int(historical_alerts_count or 0)

    feature_dict = {
        "traffic_volume": int(traffic_volume),
        "packet_count": int(packet_count),
        "request_frequency": float(round(request_frequency, 4)),
        "connection_frequency": float(round(connection_frequency, 2)),
        "failed_connections": failed_connections,
        "protocol_num": protocol_num,
        "destination_port": destination_port,
        "event_rate": float(round(event_rate, 2)),
        "historical_alerts_count": hist_alerts
    }

    return feature_dict

def to_model_input_array(features: Dict[str, Any]) -> pd.DataFrame:
    """
    Converts feature dictionary to single-row pandas DataFrame matching exact training feature names.
    """
    row = {k: features[k] for k in FEATURE_ORDER}
    return pd.DataFrame([row], columns=FEATURE_ORDER)
