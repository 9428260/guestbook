import requests
import json
url = "https://n8n.skcc-infra.net/webhook-test/ollama"
data = {
}
# 파이썬에서 서버와 통신하는 모듈을 작성해줘
headers = {'Content-Type': 'application/json'}

response = requests.get(url, json=data, headers=headers)


if response.status_code == 200:
    print('Success')
else:
    print("Error:", response.status_code, response.text)

json_objects = response.content.decode().strip().split("\n")

print(json_objects)


# 각 JSON 객체를 Python 사전으로 변환
data = [json.loads(obj) for obj in json_objects]
res_text = ''
# 변환된 데이터 출력
for item in data:
    print(item)
    res_text += item['message']['content']

print(res_text)