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

        # レスポンスが有効なパートを持っているか確認
        if not response.parts:
            # 候補があるか、finish_reasonを確認
            finish_reason_text = ""
            if response.candidates and hasattr(response.candidates[0], 'finish_reason'):
                finish_reason_text = f" (Finish Reason: {response.candidates[0].finish_reason.name})"

            # セーフティ評価があるか確認
            safety_ratings_text = ""
            if response.candidates and hasattr(response.candidates[0], 'safety_ratings'):
                ratings = [f"{rating.category.name}: {rating.probability.name}" for rating in response.candidates[0].safety_ratings if rating.probability.name != 'NEGLIGIBLE']
                if ratings:
                    safety_ratings_text = f" (Safety Ratings: {', '.join(ratings)})"
            
            error_message = f"AIからの応答が空でした。これは、コンテンツセーフティ機能によりブロックされた可能性があります。プロンプトの内容を修正して再度お試しください。{finish_reason_text}{safety_ratings_text}"
            print(f"Blocked response: {error_message}")
            return jsonify({'error': error_message, 'errorCode': 'BLOCKED_RESPONSE'}), 400

        full_response_text = response.text

        # 返信文と追加質問をパース
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
                
                # REPLY_ENDタグとQUESTIONS_ENDタグを考慮
                if reply_end_tag in reply_content:
                    reply_content = reply_content.split(reply_end_tag, 1)[0].strip()
                if questions_end_tag in questions_part:
                    additional_questions = questions_part.split(questions_end_tag, 1)[0].strip()
                else:
                    additional_questions = questions_part.strip() # QUESTIONS_ENDがない場合
            else:
                reply_content = reply_part.strip()
                if reply_end_tag in reply_content:
                    reply_content = reply_content.split(reply_end_tag, 1)[0].strip()
        else:
            reply_content = full_response_text.strip() # タグがない場合は全て返信文とみなす

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