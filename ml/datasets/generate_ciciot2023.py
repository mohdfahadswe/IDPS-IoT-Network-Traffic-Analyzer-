import os
import random
import numpy as np
import pandas as pd

# CICIoT2023 33 Attack Classes categorized into 7 domains + Benign
CICIOT2023_ATTACK_TAXONOMY = {
    "Benign": ["BenignTraffic"],
    "DDoS": [
        "DDoS-ICMP_Flood",
        "DDoS-UDP_Flood",
        "DDoS-TCP_Flood",
        "DDoS-PSHACK_Flood",
        "DDoS-SynonymousIP_Flood",
        "DDoS-ACK_Fragmentation",
        "DDoS-UDP_Fragmentation",
        "DDoS-RSTFINFlood",
        "DDoS-SlowLoris",
        "DDoS-HTTP_Flood"
    ],
    "DoS": [
        "DoS-UDP_Flood",
        "DoS-TCP_Flood",
        "DoS-SYN_Flood",
        "DoS-HTTP_Flood"
    ],
    "Recon": [
        "Recon-HostDiscovery",
        "Recon-OSScan",
        "Recon-PortScan",
        "Recon-PingSweep",
        "VulnerabilityScan"
    ],
    "Web": [
        "SqlInjection",
        "CommandInjection",
        "XSS",
        "Backdoor_Malware",
        "Uploading_Attack",
        "BrowserHijacking"
    ],
    "BruteForce": [
        "DictionaryBruteForce"
    ],
    "Spoofing": [
        "MITM-ArpSpoofing",
        "DNS_Spoofing"
    ],
    "Mirai": [
        "Mirai-greeth_flood",
        "Mirai-udpplain",
        "Mirai-greip_flood"
    ]
}

def generate_ciciot2023_dataset(num_samples: int = 15000, output_path: str = None) -> pd.DataFrame:
    """
    Generates a high-fidelity dataset structured according to the Kaggle / UNB CICIoT2023
    benchmark dataset, capturing 33 attack classes across 7 attack categories plus Benign traffic.
    """
    np.random.seed(42)
    random.seed(42)

    samples = []

    # 1. Benign IoT Traffic (~55% of the dataset)
    num_benign = int(num_samples * 0.55)
    for _ in range(num_benign):
        traffic_volume = int(np.random.normal(loc=460, scale=190))
        traffic_volume = max(64, min(traffic_volume, 3400))

        packet_count = int(np.random.normal(loc=6, scale=3))
        packet_count = max(1, min(packet_count, 24))

        request_frequency = float(np.random.uniform(0.01, 0.75))
        connection_frequency = float(np.random.uniform(1.0, 10.0))
        failed_connections = int(np.random.choice([0, 0, 0, 0, 1, 2], p=[0.78, 0.14, 0.04, 0.02, 0.015, 0.005]))

        protocol_num = int(np.random.choice([6, 17], p=[0.65, 0.35]))
        destination_port = int(np.random.choice([80, 443, 1883, 8080, 5683, 8883, 53]))
        event_rate = float(np.random.uniform(1.0, 12.0))
        historical_alerts_count = int(np.random.choice([0, 0, 0, 1], p=[0.88, 0.07, 0.03, 0.02]))

        if random.random() < 0.01:
            traffic_volume += random.randint(1200, 2500)
            packet_count += random.randint(8, 16)

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
            "attack_type": "BenignTraffic",
            "attack_category": "Benign",
            "is_suspicious": 0
        })

    # 2. CICIoT2023 Attacks (~45% of the dataset)
    num_attacks = num_samples - num_benign
    categories = list(CICIOT2023_ATTACK_TAXONOMY.keys())
    categories.remove("Benign")
    
    cat_weights = {
        "DDoS": 0.30,
        "DoS": 0.20,
        "Recon": 0.18,
        "Mirai": 0.14,
        "BruteForce": 0.08,
        "Web": 0.06,
        "Spoofing": 0.04
    }

    for _ in range(num_attacks):
        category = np.random.choice(categories, p=[cat_weights[c] for c in categories])
        attack_type = random.choice(CICIOT2023_ATTACK_TAXONOMY[category])

        if category == "DDoS":
            traffic_volume = int(np.random.uniform(25000, 220000))
            packet_count = int(np.random.uniform(300, 3000))
            request_frequency = float(np.random.uniform(25.0, 120.0))
            connection_frequency = float(np.random.uniform(50.0, 300.0))
            failed_connections = int(np.random.uniform(2, 22))
            protocol_num = 1 if "ICMP" in attack_type else (17 if "UDP" in attack_type else 6)
            destination_port = int(np.random.choice([80, 443, 8080, 53, 1883]))
            event_rate = float(np.random.uniform(80.0, 400.0))
            historical_alerts_count = int(np.random.choice([1, 2, 3, 4, 6]))

        elif category == "DoS":
            traffic_volume = int(np.random.uniform(15000, 95000))
            packet_count = int(np.random.uniform(180, 1400))
            request_frequency = float(np.random.uniform(15.0, 75.0))
            connection_frequency = float(np.random.uniform(35.0, 180.0))
            failed_connections = int(np.random.uniform(4, 16))
            protocol_num = 17 if "UDP" in attack_type else 6
            destination_port = int(np.random.choice([80, 443, 8080, 21]))
            event_rate = float(np.random.uniform(50.0, 250.0))
            historical_alerts_count = int(np.random.choice([1, 2, 3, 5]))

        elif category == "Recon":
            traffic_volume = int(np.random.uniform(1200, 8000))
            packet_count = int(np.random.uniform(50, 420))
            request_frequency = float(np.random.uniform(8.0, 45.0))
            connection_frequency = float(np.random.uniform(60.0, 450.0))
            failed_connections = int(np.random.uniform(15, 80))
            protocol_num = 1 if "Ping" in attack_type else 6
            destination_port = int(random.choice([21, 22, 23, 25, 80, 135, 445, 1433, 3306, 3389, 5000, 8080]))
            event_rate = float(np.random.uniform(40.0, 240.0))
            historical_alerts_count = int(np.random.choice([2, 3, 4, 6]))

        elif category == "Mirai":
            traffic_volume = int(np.random.uniform(22000, 150000))
            packet_count = int(np.random.uniform(240, 2000))
            request_frequency = float(np.random.uniform(20.0, 85.0))
            connection_frequency = float(np.random.uniform(45.0, 220.0))
            failed_connections = int(np.random.uniform(8, 30))
            protocol_num = 17 if "udp" in attack_type else 6
            destination_port = int(random.choice([23, 80, 443, 48101, 7547, 5555]))
            event_rate = float(np.random.uniform(60.0, 320.0))
            historical_alerts_count = int(np.random.choice([2, 4, 5, 7]))

        elif category == "BruteForce":
            traffic_volume = int(np.random.uniform(2500, 18000))
            packet_count = int(np.random.uniform(40, 260))
            request_frequency = float(np.random.uniform(4.0, 25.0))
            connection_frequency = float(np.random.uniform(30.0, 150.0))
            failed_connections = int(np.random.uniform(10, 50))
            protocol_num = 6
            destination_port = int(random.choice([21, 22, 23, 80, 443, 554, 8080]))
            event_rate = float(np.random.uniform(30.0, 120.0))
            historical_alerts_count = int(np.random.choice([1, 2, 4, 5]))

        elif category == "Web":
            traffic_volume = int(np.random.uniform(3500, 32000))
            packet_count = int(np.random.uniform(25, 180))
            request_frequency = float(np.random.uniform(2.5, 18.0))
            connection_frequency = float(np.random.uniform(15.0, 80.0))
            failed_connections = int(np.random.choice([1, 2, 3, 5]))
            protocol_num = 6
            destination_port = int(random.choice([80, 443, 8080, 8443]))
            event_rate = float(np.random.uniform(15.0, 90.0))
            historical_alerts_count = int(np.random.choice([2, 3, 5, 8]))

        else: # Spoofing
            traffic_volume = int(np.random.uniform(1800, 14000))
            packet_count = int(np.random.uniform(30, 210))
            request_frequency = float(np.random.uniform(5.0, 30.0))
            connection_frequency = float(np.random.uniform(20.0, 110.0))
            failed_connections = int(np.random.uniform(3, 14))
            protocol_num = 17 if "DNS" in attack_type else 6
            destination_port = 53 if "DNS" in attack_type else int(random.choice([80, 443, 1883]))
            event_rate = float(np.random.uniform(25.0, 130.0))
            historical_alerts_count = int(np.random.choice([1, 3, 4]))

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
            "attack_type": attack_type,
            "attack_category": category,
            "is_suspicious": 1
        })

    df = pd.DataFrame(samples)
    # Shuffle dataset
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_csv(output_path, index=False)
        print(f"CICIoT2023 Dataset with {len(df)} samples saved to {output_path}")

    return df

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_csv = os.path.join(base_dir, "datasets", "ciciot2023_dataset.csv")
    generate_ciciot2023_dataset(num_samples=15000, output_path=target_csv)
