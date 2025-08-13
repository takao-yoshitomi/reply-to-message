import os
from flask import Flask, request, jsonify, send_from_directory
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

app = Flask(__name__)

# 静的ファイル（HTML, CSS, JS）を配信するためのルート
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# 利用可能なモデル一覧を取得するためのAPIエンドポイント
@app.route('/models', methods=['POST'])
def list_models():
    data = request.get_json()
    if not data or 'apiKey' not in data:
        return jsonify({'error': 'API key is required'}), 400
    
    api_key = data['apiKey']
    try:
        genai.configure(api_key=api_key)
        model_list = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                model_list.append(m.name)
        return jsonify({'models': model_list})
    except Exception as e:
        print(f"An error occurred while listing models: {e}")
        return jsonify({'error': f"Failed to list models: {e}"}), 500

# AIの返信を生成するためのAPIエンドポイント
@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    if not data or 'prompt' not in data or 'apiKey' not in data or 'modelName' not in data:
        return jsonify({'error': 'Invalid request. prompt, apiKey, and modelName are required.'}), 400

    api_key = data['apiKey']
    prompt = data['prompt']
    model_name = data['modelName']

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        # AIの応答から引用情報を取得する
        response = model.generate_content(prompt)
        
        citations = []
        # responseオブジェクトにcitation_metadata属性が存在し、かつ中身があるかを確認
        if hasattr(response, 'citation_metadata') and response.citation_metadata:
            if hasattr(response.citation_metadata, 'citation_sources'):
                 for source in response.citation_metadata.citation_sources:
                    if hasattr(source, 'uri') and source.uri:
                        citations.append(source.uri)

        # 応答にcitationsリストを追加して返す
        return jsonify({'reply': response.text, 'citations': citations})

    except google_exceptions.ResourceExhausted as e:
        print(f"Quota exceeded: {e}")
        return jsonify({'error': 'Quota exceeded for this model.', 'errorCode': 'QUOTA_EXCEEDED'}), 429
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=8000, debug=True)