import serial
import sys

# Adjust to /dev/ttyUSB0 if needed
port = "/dev/ttyACM0"
baud = 115200

print(f"Opening port {port} at {baud} baud...")
try:
    ser = serial.Serial(port, baud, timeout=1)
    print("Connected! Listening for sensor data... (Press Ctrl+C to stop)\n")

    while True:
        # Check if there are incoming bytes waiting in the buffer
        if ser.in_waiting > 0:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if line:
                print(line)
except KeyboardInterrupt:
    print("\nExiting...")
except Exception as e:
    print(f"Error: {e}")
