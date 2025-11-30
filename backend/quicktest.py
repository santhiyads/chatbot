import requests

r = requests.post("http://localhost:8000/chat", json={"message": "tell me about rag"})
print(r.json())
