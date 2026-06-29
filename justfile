flash-esp:
  uv run esphome run air_monitor.yaml

fetch:
  curl http://192.168.1.50/metrics
