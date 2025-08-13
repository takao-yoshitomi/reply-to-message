import google.generativeai as genai

print("お使いのGemini APIキーを入力して、Enterキーを押してください:")
api_key = input()

if not api_key:
    print("APIキーが入力されませんでした。処理を終了します。")
else:
    try:
        genai.configure(api_key=api_key.strip())
        print("\n--- 利用可能なモデル一覧 ---")
        for m in genai.list_models():
            # generateContentがサポートされているモデルのみを表示
            if 'generateContent' in m.supported_generation_methods:
                print(f"モデル名: {m.name}")
        print("---------------------------")
    except Exception as e:
        print(f"\nエラーが発生しました: {e}")

