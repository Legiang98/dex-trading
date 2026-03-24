import boto3
import json
from datetime import datetime

def get_executor_logs():
    client = boto3.client('logs', region_name='us-east-1')
    log_group = '/aws/lambda/hl-executor'
    log_stream = '2026/03/24/[$LATEST]566d280d13994db09c367242915a06a3' # From the user URL

    try:
        response = client.get_log_events(
            logGroupName=log_group,
            logStreamName=log_stream,
            limit=100,
            startFromHead=True
        )
        
        print(f"\n--- Logs for {log_group} [{log_stream}] ---\n")
        for event in response.get('events', []):
            timestamp = datetime.fromtimestamp(event['timestamp']/1000.0).strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] {event['message'].strip()}")
            
    except Exception as e:
        print(f"Error fetching logs: {e}")
        print("\nAttempting to find most recent log streams...")
        try:
            streams = client.describe_log_streams(
                logGroupName=log_group,
                orderBy='LastEventTime',
                descending=True,
                limit=5
            )
            for s in streams.get('logStreams', []):
                print(f"- Stream: {s['logStreamName']} (Last event: {datetime.fromtimestamp(s['lastEventTime']/1000.0)})")
        except Exception as e2:
            print(f"Could not list streams: {e2}")

if __name__ == "__main__":
    get_executor_logs()
