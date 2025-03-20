import requests
import json
url = "http://52.79.90.51:11434/api/generate"

"""
data = {
    "model": "llama3.2:latest",
    "prompt": "Why is the sky blue?"
}
"""

data = {
    "model": "llama3.2:latest",
    "prompt": "Why is the sky blue?"
}

    # No code needed to satisfy the "fibonacci" request


headers = {'Content-Type': 'application/json'}

response = requests.post(url, json=data, headers=headers)

if response.status_code == 200:
    print('Success')
else:
    print("Error:", response.status_code, response.text)


json_objects = response.content.decode().strip().split("\n")
data = [json.loads(obj) for obj in json_objects]
res_text = ''
# 변환된 데이터 출력
for item in data:
    #print(item)
    res_text += item['response']

print(res_text)