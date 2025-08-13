import os
from flask import Flask, request, jsonify, send_from_directory
import google.generativeai as genai

app = Flask(__name__)

# 静的ファイル（HTML, CSS, JS）を配信するためのルート
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# AIの返信を生成するためのAPIエンドポイント
@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    if not data or 'prompt' not in data or 'apiKey' not in data:
        return jsonify({'error': 'Invalid request'}), 400

    api_key = data['apiKey']
    prompt = data['prompt']

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('models/gemini-1.5-flash-latest')
        
        # 同期的にコンテンツを生成
        response = model.generate_content(prompt)
        
        return jsonify({'reply': response.text})
    except Exception as e:
        print(f"An error occurred: {e}")
        # エラーレスポンスをJSON形式で返す
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=8000, debug=True)
