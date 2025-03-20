import requests
import json
url = "http://52.79.90.51:11434/api/embeddings"
data = {
    "model": "llama3.2:latest",
    "prompt": "Why is the sky blue?"
}

headers = {'Content-Type': 'application/json'}

response = requests.post(url, json=data, headers=headers)

if response.status_code == 200:
    print('Success')
else:
    print("Error:", response.status_code, response.text)

print(len(json.loads(response.content.decode())['embedding']))

print(json.loads(response.content.decode()))