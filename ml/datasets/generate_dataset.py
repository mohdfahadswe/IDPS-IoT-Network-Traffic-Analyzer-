import os
import random
import numpy as np
import pandas as pd

def generate_iot_dataset(num_samples: int = 12000, output_path: str = None) -> pd.DataFrame:
    """
    Generates realistic synthetic IoT network flow and telemetry dataset
    balancing normal sensor/device traffic and suspicious/attack patterns
    with realistic network noise and variance.
    """
    np.random.seed(42)
    random.seed(42)

    samples = []

    # 1. Normal Samples (~60%)
    num_normal = int(num_samples * 0.60)
    for _ in range(num_normal):
        traffic_volume = int(np.random.normal(loc=420, scale=180))
        traffic_volume = max(64, min(traffic_volume, 3200))
        
        packet_count = int(np.random.normal(loc=5, scale=3))
        packet_count = max(1, min(packet_count, 22))
        
        request_frequency = float(np.random.uniform(0.02, 0.85))
        connection_frequency = float(np.random.uniform(1.0, 12.0))
        failed_connections = int(np.random.choice([0, 0, 0, 0, 1, 2], p=[0.75, 0.15, 0.05, 0.03, 0.015, 0.005]))
        
        protocol_num = int(np.random.choice([6, 17], p=[0.7, 0.3]))
        destination_port = int(np.random.choice([80, 443, 1883, 8080, 5683, 8883, 53]))
        event_rate = float(np.random.uniform(1.0, 14.0))
        historical_alerts_count = int(np.random.choice([0, 0, 0, 1, 2], p=[0.85, 0.08, 0.04, 0.02, 0.01]))
        
        # Add realistic minor noise
        if random.random() < 0.012:
            traffic_volume += random.randint(1500, 3000)
            packet_count += random.randint(10, 20)

        samples.append({
            "traffic_volume": traffic_volume,
            "packet_count": packet_count,
            "request_frequency": round(request_frequency, 4),
            "connection_frequency": round(connection_frequency, 2),
            "failed_connections": failed_connections,
            "protocol_num": protocol_num,
            "destination_port": destination_port,
            "event_rate": round(event_rate, 2),
            "historical_alerts_count": historical_alerts_count,
            "is_suspicious": 0
        })

    # 2. Suspicious Samples (~40%)
    num_suspicious = num_samples - num_normal
    attack_types = ["volumetric_flood", "port_scan", "brute_force", "c2_beacon_burst", "abnormal_frequency"]
    
    for _ in range(num_suspicious):
        attack = random.choice(attack_types)
        
        if attack == "volumetric_flood":
            traffic_volume = int(np.random.uniform(18000, 180000))
            packet_count = int(np.random.uniform(220, 2200))
            request_frequency = float(np.random.uniform(12.0, 95.0))
            connection_frequency = float(np.random.uniform(40.0, 260.0))
            failed_connections = int(np.random.uniform(2, 18))
            protocol_num = int(np.random.choice([6, 17]))
            destination_port = int(np.random.choice([80, 443, 8080, 53]))
            event_rate = float(np.random.uniform(70.0, 350.0))
            historical_alerts_count = int(np.random.choice([1, 2, 3, 4, 5]))
            
        elif attack == "port_scan":
            traffic_volume = int(np.random.uniform(900, 6500))
            packet_count = int(np.random.uniform(45, 380))
            request_frequency = float(np.random.uniform(6.0, 36.0))
            connection_frequency = float(np.random.uniform(50.0, 420.0))
            failed_connections = int(np.random.uniform(12, 75))
            protocol_num = 6
            destination_port = int(random.choice([21, 22, 23, 25, 80, 135, 445, 1433, 3306, 3389, 5000, 8080]))
            event_rate = float(np.random.uniform(45.0, 220.0))
            historical_alerts_count = int(np.random.choice([2, 3, 5, 7]))
            
        elif attack == "brute_force":
            traffic_volume = int(np.random.uniform(2200, 16000))
            packet_count = int(np.random.uniform(35, 220))
            request_frequency = float(np.random.uniform(3.5, 22.0))
            connection_frequency = float(np.random.uniform(25.0, 130.0))
            failed_connections = int(np.random.uniform(8, 45))
            protocol_num = 6
            destination_port = int(random.choice([22, 23, 80, 443, 554, 8080]))
            event_rate = float(np.random.uniform(25.0, 110.0))
            historical_alerts_count = int(np.random.choice([1, 2, 4, 6]))
            
        elif attack == "c2_beacon_burst":
            traffic_volume = int(np.random.uniform(4500, 52000))
            packet_count = int(np.random.uniform(18, 140))
            request_frequency = float(np.random.uniform(1.8, 9.5))
            connection_frequency = float(np.random.uniform(12.0, 55.0))
            failed_connections = int(np.random.choice([0, 1, 2, 3]))
            protocol_num = int(np.random.choice([6, 17]))
            destination_port = int(random.choice([4444, 6667, 8443, 9001, 1337]))
            event_rate = float(np.random.uniform(18.0, 75.0))
            historical_alerts_count = int(np.random.choice([2, 3, 6, 8]))
            
        else: # abnormal_frequency
            traffic_volume = int(np.random.uniform(1100, 7500))
            packet_count = int(np.random.uniform(22, 110))
            request_frequency = float(np.random.uniform(5.5, 30.0))
            connection_frequency = float(np.random.uniform(20.0, 85.0))
            failed_connections = int(np.random.uniform(2, 10))
            protocol_num = 6
            destination_port = int(np.random.choice([80, 443, 1883]))
            event_rate = float(np.random.uniform(35.0, 140.0))
            historical_alerts_count = int(np.random.choice([1, 2, 3]))

        # Minor noise/overlap
        if random.random() < 0.01:
            traffic_volume = max(64, traffic_volume // 4)
            failed_connections = max(0, failed_connections - 5)

        samples.append({
            "traffic_volume": traffic_volume,
            "packet_count": packet_count,
            "request_frequency": round(request_frequency, 4),
            "connection_frequency": round(connection_frequency, 2),
            "failed_connections": failed_connections,
            "protocol_num": protocol_num,
            "destination_port": destination_port,
            "event_rate": round(event_rate, 2),
            "historical_alerts_count": historical_alerts_count,
            "is_suspicious": 1
        })

    df = pd.DataFrame(samples)
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_csv(output_path, index=False)
        print(f"Dataset successfully created with {len(df)} samples at {output_path}")

    return df

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    target_csv = os.path.join(current_dir, "iot_network_dataset.csv")
    generate_iot_dataset(num_samples=12000, output_path=target_csv)
