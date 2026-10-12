import os
import sys
from generate_jaafr_paper_pdf import build_pdf

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "IOT_NETWORK_TRAFFIC_ANALYZER_AND_THREAT_DETECTION_DASHBOARD_Paper.pdf"
    build_pdf(out_file)
