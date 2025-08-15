// --- DOM要素の取得 ---
// API & Model
const apiKeyInput = document.getElementById('apiKey');
const updateModelsBtn = document.getElementById('updateModelsBtn');
const modelSelector = document.getElementById('modelSelector');
const toggleApiKeyVisibilityBtn = document.getElementById('toggleApiKeyVisibilityBtn');
const apiKeySettingsArea = document.getElementById('apiKeySettingsArea');

// Mode Tabs
const replyModeTab = document.getElementById('replyModeTab');
const questionModeTab = document.getElementById('questionModeTab');
const clearInputsBtn = document.getElementById('clearInputsBtn'); // Clear button
const replyModeSettings = document.getElementById('reply-mode-settings');
const questionModeSettings = document.getElementById('question-mode-settings');

// Reply Mode Settings
const receivedMessage = document.getElementById('receivedMessage');
const micReceivedMessage = document.getElementById('mic-receivedMessage'); // Newmic button
const userRole = document.getElementById('userRole');
const otherRelationshipText = document.getElementById('rel_other_text');
const otherRelationshipRadio = document.getElementById('rel_other');
const sentimentSlider = document.getElementById('sentiment');
const sentimentValueSpan = document.getElementById('sentimentValue');
const politenessSlider = document.getElementById('politeness');
const politenessValueSpan = document.getElementById('politenessValue');
const charCount = document.getElementById('charCount');
const replyContent = document.getElementById('replyContent');
const micReplyContent = document.getElementById('mic-replyContent'); // New micbutton
const urlContainer = document.getElementById('urlContainer');
const addUrlBtn = document.getElementById('addUrlBtn');

// Question Mode Settings
const questionContent = document.getElementById('questionContent');
const expertise = document.getElementById('expertise');
const outputFormat = document.getElementById('outputFormat');
const urgency = document.getElementById('urgency');
const assumptions = document.getElementById('assumptions');
const urlContainerQuestion = document.getElementById('urlContainerQuestion');
const addUrlBtnQuestion = document.getElementById('addUrlBtnQuestion');

// Action & Output
const generateBtn = document.getElementById('generateBtn');
const loader = document.getElementById('loader');
const togglePromptBtn = document.getElementById('togglePromptBtn');
const promptDisplayArea = document.getElementById('promptDisplayArea');
const generatedPrompt = document.getElementById('generatedPrompt');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const aiReplyBox = document.getElementById('aiReply');
const copyReplyBtn = document.getElementById('copyReplyBtn');

// New: Additional Questions
const additionalQuestionsArea = document.getElementById('additionalQuestionsArea');
const additionalQuestionsList = document.getElementById('additionalQuestionsList');

// History
const historyContainer = document.getElementById('historyContainer');
const MAX_HISTORY_COUNT = 5;

// --- グローバル変数 ---
let currentMode = 'reply';

// --- 関数定義 ---

const updateModelList = async () => {
    const apiKey = apiKeyInput.value.trim();
    // 環境変数が設定されている場合を考慮し、UI上のAPIキー有無のチェックを削除
    modelSelector.innerHTML = '<option>モデルを読み込み中...</option>';
    modelSelector.disabled = true;

    const modelRecommendations = {
        'gemini-1.5-pro-latest': 5, 'gemini-1.5-pro': 5,
        'gemini-1.5-flash-latest': 4, 'gemini-1.5-flash': 4, 'gemini-1.0-pro': 4,
        'gemma-7b': 2, 'gemma-2b': 2,
        'embedding-001': 1, 'aqa': 1,
    };

    try {
        const response = await fetch('/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: apiKey })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch models');

        let ratedModels = data.models.map(modelFullName => {
            const modelName = modelFullName.replace('models/', '');
            // rating は後で設定するので、ここでは仮の値
            return {
                name: modelFullName,
                rating: 0, // 仮の値
                displayText: modelName // 仮の値
            };
        });

        // 既存の複雑なソートロジックを適用
        ratedModels.sort((a, b) => {
            const parseModelName = (fullName) => {
                const name = fullName.replace('models/', '');
                const parts = name.split('-');
                const isGemini = name.startsWith('gemini');
                let version = 0;
                let type = ''; // pro, flash, etc.
                let stability = 0; // latest > stable > preview

                if (isGemini) {
                    if (parts[1]) {
                        const versionMatch = parts[1].match(/(\d+\.\d+)/);
                        if (versionMatch) version = parseFloat(versionMatch[1]);
                    }
                    if (parts[2]) {
                        type = parts[2];
                    }
                    if (name.includes('latest')) stability = 3;
                    else if (name.includes('preview')) stability = 1;
                    else stability = 2; // stable
                }

                return { isGemini, version, type, stability, name };
            };

            const aInfo = parseModelName(a.name);
            const bInfo = parseModelName(b.name);

            // 1. Geminiファミリー優先
            if (aInfo.isGemini && !bInfo.isGemini) return -1;
            if (!aInfo.isGemini && bInfo.isGemini) return 1;

            // 2. バージョン (降順)
            if (aInfo.version !== bInfo.version) return bInfo.version - aInfo.version;

            // 3. タイプ (pro > flash)
            const typeOrder = { 'pro': 2, 'flash': 1, '': 0 }; // '' for gemini-1.0-pro
            if (typeOrder[aInfo.type] !== typeOrder[bInfo.type]) return typeOrder[bInfo.type] - typeOrder[aInfo.type];

            // 4. 安定性 (latest > stable > preview)
            if (aInfo.stability !== bInfo.stability) return bInfo.stability - aInfo.stability;

            // 最終的に名前でソート (昇順)
            return aInfo.name.localeCompare(bInfo.name);
        });

        // ソート後のインデックスに基づいて星の数を割り当て
        ratedModels = ratedModels.map((model, index) => {
            let starCount;

            // 基本の星の割り当て (上から5個が5つ星、次の5個が4つ星...)
            if (index < 5) {
                starCount = 5;
            } else if (index < 10) {
                starCount = 4;
            } else if (index < 15) {
                starCount = 3;
            } else if (index < 20) {
                starCount = 2;
            } else {
                starCount = 1;
            }

            // pro は +1、preview は -1
            const modelName = model.name.replace('models/', '');
            if (modelName.includes('pro')) {
                starCount += 1;
            }
            if (modelName.includes('preview')) {
                starCount -= 1;
            }

            // 最高は5、最低は1に制限
            starCount = Math.max(1, Math.min(5, starCount));

            return {
                ...model,
                rating: starCount,
                displayText: `${ '★'.repeat(starCount) }${ '☆'.repeat(5 - starCount) } ${model.displayText}`
            };
        });

        modelSelector.innerHTML = '';
        ratedModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.displayText;
            modelSelector.appendChild(option);
        });

        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel) modelSelector.value = savedModel;

    } catch (error) {
        console.error('Error fetching models:', error);
        modelSelector.innerHTML = '<option>読み込み失敗</option>';
        alert(`モデル一覧の取得に失敗しました: ${error.message}`);
    } finally {
        modelSelector.disabled = false;
    }
};

function switchMode(mode) {
    currentMode = mode;
    if (mode === 'reply') {
        replyModeTab.classList.add('active');
        questionModeTab.classList.remove('active');
        replyModeSettings.classList.remove('hidden');
        questionModeSettings.classList.add('hidden');
        generateBtn.textContent = 'AIで返信を生成';
    } else {
        replyModeTab.classList.remove('active');
        questionModeTab.classList.add('active');
        replyModeSettings.classList.add('hidden');
        questionModeSettings.classList.remove('hidden');
        generateBtn.textContent = 'AIに質問する';
    }
}

function togglePromptVisibility() {
    const isHidden = promptDisplayArea.classList.toggle('hidden');
    togglePromptBtn.textContent = isHidden ? 'プロンプトを表示' : 'プロンプトを非表示';
}

function addUrlField(container, url = '') {
    const div = document.createElement('div');
    div.className = 'url-item';
    div.innerHTML = `<input type="text" class="url-input" value="${url}" placeholder="https://example.com"><button type="button" class="remove-url-btn">削除</button>`;
    container.appendChild(div);
}

function copyToClipboard(text, button, originalText) {
    if (navigator.clipboard && text && !text.includes('ここに...')) {
        navigator.clipboard.writeText(text).then(() => {
            button.textContent = 'コピーしました！';
            setTimeout(() => { button.textContent = originalText; }, 2000);
        });
    }
}

function getReplyModeSettings() {
    let relationship = document.querySelector('input[name="relationship"]:checked').value;
    if (relationship === 'other') relationship = otherRelationshipText.value || 'その他';
    const urlInputs = Array.from(urlContainer.querySelectorAll('.url-input')).map(input => input.value.trim()).filter(url => url);
    return {
        mode: 'reply',
        receivedMessage: receivedMessage.value,
        userRole: userRole.value,
        relationship: relationship,
        sentiment: sentimentSlider.value,
        politeness: politenessSlider.value,
        charCount: charCount.value,
        punctuation: document.querySelector('input[name="punctuation"]:checked').value,
        replyContent: replyContent.value,
        referenceUrls: urlInputs,
                relationshipRadio: document.querySelector('input[name="relationship"]:checked').id,
        selectedModel: modelSelector.value
    };
}

function getQuestionModeSettings() {
    const urlInputs = Array.from(urlContainerQuestion.querySelectorAll('.url-input')).map(input => input.value.trim()).filter(url => url);
    return {
        mode: 'question',
        question: questionContent.value,
        expertise: expertise.value,
        outputFormat: outputFormat.value,
        urgency: urgency.value,
        assumptions: assumptions.value,
        referenceUrls: urlInputs,
        selectedModel: modelSelector.value
    };
}

function createReplyPrompt(settings) {
    const urlsText = settings.referenceUrls.length > 0 ? settings.referenceUrls.map(url => `- ${url}`).join('\n') : '指定なし';
    let prompt = `あなたは優秀なコピーライターです。
以下のメッセージに対するLINEの返信文を、後述する設定に基づいて作成してください。
\n文中に*や**は絶対に使用しないでください。読みにくいです。
\n返信内容作成にあたり、webサイトで10件前後、最新の情報を調べてから2人の優秀な専門家で話し合った後、返信文を作成して下さい又、この情報について信頼出来る情報源を最大3つ、そのサイトが検索出来るタイトルを文末に記載してください（URLは不要）
--- 相手のメッセージ ---
${settings.receivedMessage || '（メッセージが入力されていません）'}\n------------------------\n
設定:
- **役割**: ${settings.userRole || '指定なし'}\n- **相手との関係性**: ${settings.relationship || '指定なし'}\n- **感情の方向性 (否定的/肯定的)**: ${settings.sentiment}\n- **丁寧度**: ${settings.politeness}\n- **返信の概算文字数**: ${settings.charCount || '指定なし'}\n- **句読点**: ${settings.punctuation}\n- **返信に含めるべき内容**: ${settings.replyContent || '指定なし'}\n- **参照情報**:
${urlsText}\n\n\n文中に*や**は絶対に使用しないでください。読みにくいです。`;

        // 追加質問の指示
    prompt += `\n\n-------- 追加質問の提案 --------\n上記の返信文を生成するにあたり、追加で情報が必要だと感じた場合、箇条書きで3つまで①②③と提案してください。\n`;

   
    prompt += `\n\n以上の情報を用いて、自然で適切な返信文を作成してください。`;

    prompt += `\n\n[REPLY_START]\n`;
    return prompt;
}

function createQuestionPrompt(settings) {
    const urlsText = settings.referenceUrls.length > 0 ? settings.referenceUrls.map(url => `- ${url}`).join('\n') : '指定なし';
    let prompt = `あなたは指定された専門分野の専門家です。
以下の質問に対して、後述する設定に基づいて、正確かつ分かりやすい回答を作成してください。

--- 質問内容 ---
${settings.question || '（質問が入力されていません）'}\n--------------------

設定:
- **専門分野**: ${settings.expertise || '一般的な知識'}\n- **望ましい回答形式**: ${settings.outputFormat || '指定なし'}\n- **緊急度**: ${settings.urgency || '指定なし'}\n- **前提情報・文脈**: ${settings.assumptions || '指定なし'}\n- **参照情報**:
${urlsText}\n
以上の情報を用いて、質の高い回答を作成してください。`;

    // 追加質問の指示
    prompt += `\n\n--- 追加質問の提案 ---\n上記の回答を生成するにあたり、もし追加で情報が必要だと感じた場合、またはユーザーが次に聞くべきだと考えられる質問があれば、箇条書きで3つまで提案してください。提案がない場合は「提案なし」と記載してください。\n\n[REPLY_START]\n`;
    return prompt;
}

function setupSpeechRecognition(micButton, targetTextarea) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
  const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

  if (!SpeechRecognition) {
    micButton.disabled = true;
    micButton.title = "音声入力はサポートされていません";
    return;
  }

  const recognition = new SpeechRecognition();
  const speechRecognitionList = new SpeechGrammarList();
  // recognition.grammars = speechRecognitionList; // 必要に応じて文法リストを設定
  recognition.continuous = false; // 一度発言したら停止
  recognition.lang = 'ja-JP'; // 日本語に設定
  recognition.interimResults = false; // 中間結果は不要
  recognition.maxAlternatives = 1; // 最も確信度の高い結果のみ

  micButton.addEventListener('click', () => {
    if (micButton.classList.contains('is-recording')) {
      recognition.stop();
      return;
    }
    recognition.start();
  });

  recognition.onstart = () => {
    micButton.classList.add('is-recording');
    micButton.textContent = '🔴'; // 録音中アイコン
    micButton.title = '録音中...クリックで停止';
    targetTextarea.focus();
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    targetTextarea.value += transcript; // 既存のテキストに追加
  };

  recognition.onend = () => {
    micButton.classList.remove('is-recording');
    micButton.textContent = '🎤'; // 通常アイコン
    micButton.title = '音声入力';
  };

  recognition.onerror = (event) => {
    micButton.classList.remove('is-recording');
    micButton.textContent = '🎤'; // 通常アイコン
    micButton.title = '音声入力';
    console.error('Speech recognition error:', event.error);
    alert(`音声認識エラー: ${event.error}`);
  };
}



// --- イベントリスナー設定 ---

toggleApiKeyVisibilityBtn.addEventListener('click', () => {
    const isHidden = apiKeySettingsArea.classList.contains('hidden');
    if (isHidden) {
        if (confirm('APIキーを表示・編集しますか？\n第三者に見られないよう注意してください。')) {
            apiKeySettingsArea.classList.remove('hidden');
            toggleApiKeyVisibilityBtn.textContent = '閉じる';
        }
    } else {
        apiKeySettingsArea.classList.add('hidden');
        toggleApiKeyVisibilityBtn.textContent = 'APIキーを編集';
    }
});

apiKeyInput.addEventListener('change', () => {
    const newApiKey = apiKeyInput.value.trim();
    if (confirm('APIキーを更新して保存しますか？')) {
        localStorage.setItem('geminiApiKey', newApiKey);
        alert('APIキーを保存しました。');
        if (newApiKey) updateModelList();
    } else {
        apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
    }
});

modelSelector.addEventListener('change', () => localStorage.setItem('selectedModel', modelSelector.value));
updateModelsBtn.addEventListener('click', updateModelList);
replyModeTab.addEventListener('click', () => switchMode('reply'));
questionModeTab.addEventListener('click', () => switchMode('question'));
togglePromptBtn.addEventListener('click', togglePromptVisibility);
addUrlBtn.addEventListener('click', () => addUrlField(urlContainer));
urlContainer.addEventListener('click', (e) => { if (e.target.classList.contains('remove-url-btn')) e.target.parentElement.remove(); });
addUrlBtnQuestion.addEventListener('click', () => addUrlField(urlContainerQuestion));
urlContainerQuestion.addEventListener('click', (e) => { if (e.target.classList.contains('remove-url-btn')) e.target.parentElement.remove(); });
sentimentSlider.addEventListener('input', () => { sentimentValueSpan.textContent = sentimentSlider.value; });
politenessSlider.addEventListener('input', () => { politenessValueSpan.textContent = politenessSlider.value; });
otherRelationshipText.addEventListener('focus', () => { otherRelationshipRadio.checked = true; });

// ★更新: メインのAI生成ボタン (Citations対応)
generateBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    // 環境変数が設定されている場合を考慮し、UI上のAPIキー有無のチェックを削除
    if (!modelSelector.value || modelSelector.value === 'モデルを読み込み中...' || modelSelector.value === '読み込み失敗') {
        alert('使用モデルを正しく設定してください。');
        return;
    }

    let settings, prompt;
    if (currentMode === 'reply') {
        settings = getReplyModeSettings();
        prompt = createReplyPrompt(settings);
    } else {
        settings = getQuestionModeSettings();
        prompt = createQuestionPrompt(settings);
    }

    generatedPrompt.textContent = prompt;
    loader.style.display = 'block';
    generateBtn.disabled = true;
    aiReplyBox.textContent = 'AIが応答を生成中です...';

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, apiKey, modelName: settings.selectedModel }),
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.errorCode === 'QUOTA_EXCEEDED') {
                alert('選択したモデルの無料利用枠を使い切りました。別のモデルを選択して再度お試しください。');
                aiReplyBox.textContent = '利用枠の上限に達しました。モデルを変更してください。';
            } else if (data.errorCode === 'BLOCKED_RESPONSE') {
                // サーバー側で設定した新しいエラーコード
                alert(data.error); // サーバーからの詳細なエラーメッセージを表示
                aiReplyBox.textContent = data.error;
            } else {
                throw new Error(data.error || '不明なエラーが発生しました。');
            }
        } else {
            const aiReply = data.reply;
            const aiCitations = data.citations || [];
            const additionalQuestions = data.additionalQuestions || ''; // additionalQuestions を取得

            aiReplyBox.textContent = aiReply;

            // 追加質問の表示ロジック
            additionalQuestionsList.innerHTML = ''; // リストをクリア
            if (additionalQuestions && additionalQuestions.trim() !== '提案なし') {
                additionalQuestionsArea.classList.remove('hidden');
                const questions = additionalQuestions.split('\n').filter(q => q.trim() !== '');
                questions.forEach(q => {
                    const li = document.createElement('li');
                    li.textContent = q.trim();
                    additionalQuestionsList.appendChild(li);
                });
            } else {
                additionalQuestionsArea.classList.add('hidden'); // 提案がない場合は非表示
            }

            saveToHistory(settings, prompt, aiReply, aiCitations, additionalQuestions); // additionalQuestions を履歴に渡す
        }

    } catch (error) {
        console.error('Error:', error);
        if (!aiReplyBox.textContent.includes('利用枠')) {
            aiReplyBox.textContent = `エラーが発生しました: ${error.message}`;
        }
        alert(`エラーが発生しました: ${error.message}`);
    } finally {
        loader.style.display = 'none';
        generateBtn.disabled = false;
        renderHistory();
    }
});

// コピーボタン
copyPromptBtn.addEventListener('click', () => copyToClipboard(generatedPrompt.textContent, copyPromptBtn, 'クリップボードにコピー'));
copyReplyBtn.addEventListener('click', () => copyToClipboard(aiReplyBox.textContent, copyReplyBtn, '返信をコピー'));


// --- 履歴関連の関数 ---

// ★更新: saveToHistory (aiCitations, additionalQuestions引数を追加)
function saveToHistory(settings, prompt, aiReply, aiCitations, additionalQuestions) {
    let history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
    history.unshift({ settings, prompt, aiReply, aiCitations, additionalQuestions, timestamp: new Date().toISOString() });
    history = history.slice(0, MAX_HISTORY_COUNT);
    localStorage.setItem('promptHistory', JSON.stringify(history));
}

// ★更新: renderHistory (AI参照URLの表示機能を追加)
function renderHistory() {
    historyContainer.innerHTML = '';
    const history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
    if (history.length === 0) {
        historyContainer.innerHTML = '<p>まだ履歴はありません。</p>';
        return;
    }
    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const mainContent = document.createElement('div');
        mainContent.className = 'history-main-content';

        const modeLabel = item.settings.mode === 'question' ? '[質問]' : '[返答]';
        const previewText = (item.aiReply || '（応答なし）').substring(0, 100);

        const promptPreview = document.createElement('pre');
        promptPreview.innerHTML = `<strong>${modeLabel}</strong> ${previewText}...<br><small>Model: ${item.settings.selectedModel || 'N/A'}</small>`;
        mainContent.appendChild(promptPreview);

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'history-controls';
        const timestamp = document.createElement('span');
        timestamp.className = 'history-timestamp';
        const date = new Date(item.timestamp);
        timestamp.textContent = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        
        const restoreButton = document.createElement('button');
        restoreButton.className = 'restore-history-btn';
        restoreButton.textContent = 'この内容を復元';
        restoreButton.addEventListener('click', () => restoreFromHistory(index));
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-history-btn';
        deleteButton.textContent = '削除';
        deleteButton.addEventListener('click', () => deleteFromHistory(index));
        
        controlsContainer.appendChild(timestamp);
        controlsContainer.appendChild(restoreButton);
        controlsContainer.appendChild(deleteButton);

        const userUrls = item.settings.referenceUrls;
        if (userUrls && userUrls.length > 0 && userUrls.some(u => u)) {
            const urlContainer = document.createElement('div');
            urlContainer.className = 'history-urls-container hidden';
            const urlList = document.createElement('ul');
            userUrls.forEach(url => {
                if (!url) return;
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = url; a.textContent = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                li.appendChild(a);
                urlList.appendChild(li);
            });
            mainContent.appendChild(urlContainer);

            const toggleUrlsBtn = document.createElement('button');
            toggleUrlsBtn.className = 'toggle-history-urls-btn';
            toggleUrlsBtn.textContent = `あなたが参照したURL (${userUrls.filter(u=>u).length}件)`;
            toggleUrlsBtn.addEventListener('click', () => {
                const isHidden = urlContainer.classList.toggle('hidden');
                toggleUrlsBtn.textContent = isHidden ? `あなたが参照したURL (${userUrls.filter(u=>u).length}件)` : 'URLを非表示';
            });
            controlsContainer.appendChild(toggleUrlsBtn);
        }

        const aiUrls = item.aiCitations;
        if (aiUrls && aiUrls.length > 0) {
            const urlContainer = document.createElement('div');
            urlContainer.className = 'history-urls-container hidden';
            const urlList = document.createElement('ul');
            aiUrls.forEach(url => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = url; a.textContent = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                li.appendChild(a);
                urlList.appendChild(li);
            });
            mainContent.appendChild(urlContainer);

            const toggleUrlsBtn = document.createElement('button');
            toggleUrlsBtn.className = 'toggle-history-urls-btn ai-citation';
            toggleUrlsBtn.textContent = `AIが参照したURL (${aiUrls.length}件)`;
            toggleUrlsBtn.addEventListener('click', () => {
                const isHidden = urlContainer.classList.toggle('hidden');
                toggleUrlsBtn.textContent = isHidden ? `AIが参照したURL (${aiUrls.length}件)` : 'URLを非表示';
            });
            controlsContainer.appendChild(toggleUrlsBtn);
        }

        const additionalQuestions = item.additionalQuestions;
        if (additionalQuestions && additionalQuestions.trim() !== '' && additionalQuestions.trim() !== '提案なし') {
            const questionsContainer = document.createElement('div');
            questionsContainer.className = 'history-questions-container hidden';
            const questionsList = document.createElement('ul');
            additionalQuestions.split('\n').filter(q => q.trim() !== '').forEach(q => {
                const li = document.createElement('li');
                li.textContent = q.trim();
                questionsList.appendChild(li);
            });
            questionsContainer.appendChild(questionsList);
            mainContent.appendChild(questionsContainer);

            const toggleQuestionsBtn = document.createElement('button');
            toggleQuestionsBtn.className = 'toggle-history-questions-btn';
            toggleQuestionsBtn.textContent = `AIからの追加質問の提案`;
            toggleQuestionsBtn.addEventListener('click', () => {
                const isHidden = questionsContainer.classList.toggle('hidden');
                toggleQuestionsBtn.textContent = isHidden ? `AIからの追加質問の提案` : '質問を非表示';
            });
            controlsContainer.appendChild(toggleQuestionsBtn);
        }
        
        historyItem.appendChild(mainContent);
        historyItem.appendChild(controlsContainer);
        historyContainer.appendChild(historyItem);
    });
}

function deleteFromHistory(index) {
    if (!confirm('この履歴を本当に削除しますか？')) return;
    let history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
    history.splice(index, 1);
    localStorage.setItem('promptHistory', JSON.stringify(history));
    renderHistory();
}

async function restoreFromHistory(index) {
    const history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
    const item = history[index];
    if (!item) return;

    const settings = item.settings;
    const mode = settings.mode || 'reply';

    switchMode(mode);

    if (mode === 'reply') {
        receivedMessage.value = settings.receivedMessage;
        userRole.value = settings.userRole;
        sentimentSlider.value = settings.sentiment;
        sentimentValueSpan.textContent = settings.sentiment;
        politenessSlider.value = settings.politeness;
        politenessValueSpan.textContent = settings.politeness;
        charCount.value = settings.charCount;
        document.querySelector(`input[name="punctuation"][value="${settings.punctuation || 'あり'}"]`).checked = true;
        replyContent.value = settings.replyContent;
        const radioToSelect = document.getElementById(settings.relationshipRadio);
        if (radioToSelect) radioToSelect.checked = true;
        if (settings.relationshipRadio === 'rel_other') {
            otherRelationshipText.value = settings.relationship;
        } else {
            otherRelationshipText.value = '';
        }
        urlContainer.innerHTML = '';
        if (settings.referenceUrls && settings.referenceUrls.length > 0) {
            settings.referenceUrls.forEach(url => addUrlField(urlContainer, url));
        }
    } else { // question mode
        questionContent.value = settings.question;
        expertise.value = settings.expertise;
        outputFormat.value = settings.outputFormat;
        urgency.value = settings.urgency;
        assumptions.value = settings.assumptions;
        urlContainerQuestion.innerHTML = '';
        if (settings.referenceUrls && settings.referenceUrls.length > 0) {
            settings.referenceUrls.forEach(url => addUrlField(urlContainerQuestion, url));
        }
    }

    generatedPrompt.textContent = item.prompt;
    aiReplyBox.textContent = item.aiReply || '';

    // additionalQuestions の復元表示
    additionalQuestionsList.innerHTML = ''; // リストをクリア
    if (item.additionalQuestions && item.additionalQuestions.trim() !== '' && item.additionalQuestions.trim() !== '提案なし') {
        additionalQuestionsArea.classList.remove('hidden');
        const questions = item.additionalQuestions.split('\n').filter(q => q.trim() !== '');
        questions.forEach(q => {
            const li = document.createElement('li');
            li.textContent = q.trim();
            additionalQuestionsList.appendChild(li);
        });
    } else {
        additionalQuestionsArea.classList.add('hidden');
    }

    promptDisplayArea.classList.remove('hidden');
    togglePromptBtn.textContent = 'プロンプトを非表示';

    if(settings.selectedModel) modelSelector.value = settings.selectedModel;

    window.scrollTo(0, 0);
    alert('入力内容を履歴から復元しました。');
}

function clearAllInputs() {
    if (!confirm('すべての入力内容をクリアしてもよろしいですか？\n（生成履歴は消えません）')) {
        return;
    }

    // 返答モードの入力欄をリセット
    receivedMessage.value = '';
    userRole.value = '税理士事務所職員'; // デフォルト値
    document.getElementById('rel_client').checked = true;
    otherRelationshipText.value = '';
    sentimentSlider.value = 100;
    sentimentValueSpan.textContent = '100';
    politenessSlider.value = 80;
    politenessValueSpan.textContent = '80';
    charCount.value = '';
    document.getElementById('punc_yes').checked = true;
    replyContent.value = '';
    urlContainer.innerHTML = '';
    addUrlField(urlContainer);

    // 質問モードの入力欄をリセット
    questionContent.value = '';
    expertise.value = '';
    outputFormat.value = '';
    urgency.value = 'medium';
    assumptions.value = '';
    urlContainerQuestion.innerHTML = '';
    addUrlField(urlContainerQuestion);

    // 出力エリアをリセット
    generatedPrompt.textContent = 'ここにプロンプトが表示されます...';
    aiReplyBox.textContent = 'ここにAIからの返信が表示されます...';
    additionalQuestionsArea.classList.add('hidden');
    additionalQuestionsList.innerHTML = '';
    
    promptDisplayArea.classList.add('hidden');
    togglePromptBtn.textContent = 'プロンプトを表示';

    alert('入力内容をクリアしました。');
}

// --- イベントリスナー設定 (追加) ---
clearInputsBtn.addEventListener('click', clearAllInputs);

// --- 初期化処理 ---
(async () => {
    apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
    addUrlField(urlContainer);
    addUrlField(urlContainerQuestion);

    setupSpeechRecognition(micReceivedMessage, receivedMessage);
    setupSpeechRecognition(micReplyContent, replyContent);

    renderHistory();
    // ★APIキーがあればモデルリストを自動更新
    if (apiKeyInput.value) {
        await updateModelList();
    }
    switchMode('reply');
})();
