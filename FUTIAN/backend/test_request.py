import requests
import json

url = "http://localhost:8000/chat"
payload = {
    "message": "Where is Bursary Unit?",
    "history": []
}
headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status: {response.status_code}")
    # print(f"Response: {response.json()}") # Don't print full response, just status
except Exception as e:
    print(f"Error: {e}")
