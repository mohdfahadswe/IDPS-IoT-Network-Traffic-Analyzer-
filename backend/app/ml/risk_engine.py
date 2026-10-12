from typing import Tuple, List, Dict, Any

class RiskScoringEngine:
    @staticmethod
    def calculate_risk(
        rf_is_suspicious: bool,
        rf_confidence: float,
        features: Dict[str, Any],
        domain_risk: float = 0.0,
        rf_reasons: List[str] = None
    ) -> Tuple[float, str, List[str]]:
        """
        Calculates a composite 0-100 risk score and generates transparent reasons.
        Returns:
            score (float): 0.0 to 100.0
            level (str): Low, Medium, High, Critical
            reasons (List[str]): Interpretable explanations for the assigned score
        """
        reasons = list(rf_reasons or [])
        score = 5.0 # baseline normal operational noise

        # 1. Random Forest Machine Learning factor (up to 40 points)
        if rf_is_suspicious:
            rf_points = 25.0 + (rf_confidence * 15.0)
            score += rf_points
            if not any("Random Forest" in r for r in reasons):
                reasons.append(f"Random Forest classified activity as suspicious (confidence {rf_confidence*100:.1f}%)")

        # 2. Volumetric Traffic Factor (up to 20 points)
        traffic_volume = features.get("traffic_volume", 0)
        if traffic_volume > 100000:
            score += 20.0
        elif traffic_volume > 25000:
            score += 15.0
        elif traffic_volume > 5000:
            score += 8.0

        # 3. Request & Connection Frequency Factor (up to 15 points)
        freq = features.get("request_frequency", 0.0)
        if freq > 50.0:
            score += 15.0
        elif freq > 10.0:
            score += 10.0
        elif freq > 3.0:
            score += 5.0

        # 4. Failed Connection Factor (up to 15 points)
        failed_conns = features.get("failed_connections", 0)
        if failed_conns >= 15:
            score += 15.0
        elif failed_conns >= 5:
            score += 10.0
        elif failed_conns >= 2:
            score += 4.0

        # 5. Domain Risk Factor (up to 15 points)
        if domain_risk > 70.0:
            score += 15.0
            reasons.append(f"Associated with high-risk domain (domain score {domain_risk:.0f})")
        elif domain_risk > 40.0:
            score += 8.0
            reasons.append(f"Contacted domain flagged with moderate risk (domain score {domain_risk:.0f})")

        # 6. Historical Infractions (up to 10 points)
        hist_alerts = features.get("historical_alerts_count", 0)
        if hist_alerts >= 5:
            score += 10.0
        elif hist_alerts >= 2:
            score += 5.0

        # Cap score between 0 and 100
        score = min(100.0, max(0.0, score))
        score = round(score, 1)

        # Map to Risk Level
        if score <= 30.0:
            level = "Low"
        elif score <= 60.0:
            level = "Medium"
        elif score <= 80.0:
            level = "High"
        else:
            level = "Critical"

        if not reasons:
            reasons.append("Telemetry metrics within normal baseline operational thresholds")

        return score, level, reasons

risk_engine = RiskScoringEngine()
