import os
from flask import Flask, request, jsonify, send_from_directory
from flask_httpauth import HTTPBasicAuth
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

app = Flask(__name__)
auth = HTTPBasicAuth()

# --- Basic認証の設定 ---
# 環境変数からユーザー名とパスワードを取得
BASIC_AUTH_USERNAME = os.getenv('BASIC_AUTH_USERNAME')
BASIC_AUTH_PASSWORD = os.getenv('BASIC_AUTH_PASSWORD')

@auth.verify_password
def verify_password(username, password):
    # 環境変数が設定されている場合のみ認証を有効にする
    if BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD:
        if username == BASIC_AUTH_USERNAME and password == BASIC_AUTH_PASSWORD:
            return username
    # 環境変数が設定されていない場合は、認証をスキップ（誰でもアクセス可能）
    elif not BASIC_AUTH_USERNAME and not BASIC_AUTH_PASSWORD:
        return "anonymous"
    return None

# --- アプリケーションのルート設定 ---

@app.route('/')
@auth.login_required
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
@auth.login_required
def static_files(path):
    # favicon.icoへのリクエストは認証をスキップ（ブラウザが自動で要求するため）
    if path == 'favicon.ico':
        return send_from_directory('.', path, mimetype='image/vnd.microsoft.icon')
    return send_from_directory('.', path)

@app.route('/models', methods=['POST'])
@auth.login_required
def list_models():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        data = request.get_json(silent=True)
        if not data or 'apiKey' not in data or not data['apiKey']:
            return jsonify({'error': 'API key is required. Set GEMINI_API_KEY environment variable or provide it in the UI.'}), 400
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

@app.route('/generate', methods=['POST'])
@auth.login_required
def generate():
    data = request.get_json()
    if not data or 'prompt' not in data or 'modelName' not in data:
        return jsonify({'error': 'Invalid request. prompt and modelName are required.'}), 400

    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        if 'apiKey' not in data or not data['apiKey']:
            return jsonify({'error': 'API key is required. Set GEMINI_API_KEY environment variable or provide it in the UI.'}), 400
        api_key = data['apiKey']

    prompt = data['prompt']
    model_name = data['modelName']

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        response = model.generate_content(prompt)

        if not response.parts:
            finish_reason_text = ""
            if response.candidates and hasattr(response.candidates[0], 'finish_reason'):
                finish_reason_text = f" (Finish Reason: {response.candidates[0].finish_reason.name})"
            safety_ratings_text = ""
            if response.candidates and hasattr(response.candidates[0], 'safety_ratings'):
                ratings = [f"{rating.category.name}: {rating.probability.name}" for rating in response.candidates[0].safety_ratings if rating.probability.name != 'NEGLIGIBLE']
                if ratings:
                    safety_ratings_text = f" (Safety Ratings: {', '.join(ratings)})"
            
            error_message = f"AIからの応答が空でした。これは、コンテンツセーフティ機能によりブロックされたか、利用枠を超過した可能性があります。{finish_reason_text}{safety_ratings_text}"
            print(f"Blocked response: {error_message}")
            return jsonify({'error': error_message, 'errorCode': 'BLOCKED_RESPONSE'}), 400

        full_response_text = response.text

        # (The rest of the parsing logic remains the same)
        reply_start_tag = "[REPLY_START]"
        questions_start_tag = "[QUESTIONS_START]"
        reply_end_tag = "[REPLY_END]"
        questions_end_tag = "[QUESTIONS_END]"

        reply_content = ""
        additional_questions = ""

        if reply_start_tag in full_response_text:
            reply_part = full_response_text.split(reply_start_tag, 1)[1]
            if questions_start_tag in reply_part:
                reply_content = reply_part.split(questions_start_tag, 1)[0].strip()
                questions_part = reply_part.split(questions_start_tag, 1)[1].strip()
                
                if reply_end_tag in reply_content:
                    reply_content = reply_content.split(reply_end_tag, 1)[0].strip()
                if questions_end_tag in questions_part:
                    additional_questions = questions_part.split(questions_end_tag, 1)[0].strip()
                else:
                    additional_questions = questions_part.strip()
            else:
                reply_content = reply_part.strip()
                if reply_end_tag in reply_content:
                    reply_content = reply_content.split(reply_end_tag, 1)[0].strip()
        else:
            reply_content = full_response_text.strip()

        citations = []
        if hasattr(response, 'citation_metadata') and response.citation_metadata:
            if hasattr(response.citation_metadata, 'citation_sources'):
                 for source in response.citation_metadata.citation_sources:
                    if hasattr(source, 'uri') and source.uri:
                        citations.append(source.uri)

        return jsonify({'reply': reply_content, 'citations': citations, 'additionalQuestions': additional_questions})

    except google_exceptions.ResourceExhausted as e:
        print(f"Quota exceeded: {e}")
        return jsonify({'error': 'Quota exceeded for this model.', 'errorCode': 'QUOTA_EXCEEDED'}), 429
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=8000, debug=True)