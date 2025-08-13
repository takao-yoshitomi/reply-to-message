// --- DOM要素の取得 ---
// API & Model
const apiKeyInput = document.getElementById('apiKey');
const updateModelsBtn = document.getElementById('updateModelsBtn');
const modelSelector = document.getElementById('modelSelector');

// Mode Tabs
const replyModeTab = document.getElementById('replyModeTab');
const questionModeTab = document.getElementById('questionModeTab');
const replyModeSettings = document.getElementById('reply-mode-settings');
const questionModeSettings = document.getElementById('question-mode-settings');

// Reply Mode Settings
const receivedMessage = document.getElementById('receivedMessage');
const userRole = document.getElementById('userRole');
const otherRelationshipText = document.getElementById('rel_other_text');
const otherRelationshipRadio = document.getElementById('rel_other');
const sentimentSlider = document.getElementById('sentiment');
const sentimentValueSpan = document.getElementById('sentimentValue');
const politenessSlider = document.getElementById('politeness');
const politenessValueSpan = document.getElementById('politenessValue');
const charCount = document.getElementById('charCount');
const replyContent = document.getElementById('replyContent');
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

// History
const historyContainer = document.getElementById('historyContainer');
const MAX_HISTORY_COUNT = 10; // 少し増やしました

// --- グローバル変数 ---
let currentMode = 'reply'; // 現在のモードを追跡

// --- 関数定義 ---

// モデル一覧をサーバーに問い合わせて更新
const updateModelList = async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('モデル一覧を取得するには、まずAPIキーを入力してください。');
        return;
    }
    modelSelector.innerHTML = '<option>モデルを読み込み中...</option>';
    modelSelector.disabled = true;

    try {
        const response = await fetch('/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: apiKey })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch models');

        modelSelector.innerHTML = '';
        data.models.forEach(modelName => {
            const option = document.createElement('option');
            option.value = modelName;
            option.textContent = modelName;
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

// ★新機能: モード切替
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

// ★新機能: プロンプト表示切替
function togglePromptVisibility() {
    const isHidden = promptDisplayArea.classList.toggle('hidden');
    togglePromptBtn.textContent = isHidden ? 'プロンプトを表示' : 'プロンプトを非表示';
}

// ★更新: URLフィールド追加 (コンテナを引数に取る)
function addUrlField(container, url = '') {
    const div = document.createElement('div');
    div.className = 'url-item';
    div.innerHTML = `<input type="text" class="url-input" value="${url}" placeholder="https://example.com"><button type="button" class="remove-url-btn">削除</button>`;
    container.appendChild(div);
}

// クリップボードにコピー
function copyToClipboard(text, button, originalText) {
    if (navigator.clipboard && text && !text.includes('ここに...')) {
        navigator.clipboard.writeText(text).then(() => {
            button.textContent = 'コピーしました！';
            setTimeout(() => { button.textContent = originalText; }, 2000);
        });
    }
}

// --- 設定値の取得とプロンプト生成 ---

// ★更新: 返信モードの設定を取得
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

// ★新機能: 質問モードの設定を取得
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

// ★更新: 返信モードのプロンプトを生成
function createReplyPrompt(settings) {
    const urlsText = settings.referenceUrls.length > 0 ? settings.referenceUrls.map(url => `- ${url}`).join('\n') : '指定なし';
    return `あなたは優秀なコピーライターです。
以下のメッセージに対するLINEの返信文を、後述する設定に基づいて作成してください。

--- 相手のメッセージ ---
${settings.receivedMessage || '（メッセージが入力されていません）'}\n------------------------\n
設定:
- **役割**: ${settings.userRole || '指定なし'}
- **相手との関係性**: ${settings.relationship || '指定なし'}
- **感情の方向性 (否定的/肯定的)**: ${settings.sentiment}
- **丁寧度**: ${settings.politeness}
- **返信の概算文字数**: ${settings.charCount || '指定なし'}
- **句読点**: ${settings.punctuation}
- **返信に含めるべき内容**: ${settings.replyContent || '指定なし'}
- **参照情報**:
${urlsText}

以上の情報を用いて、自然で適切な返信文を作成してください。`;
}

// ★新機能: 質問モードのプロンプトを生成
function createQuestionPrompt(settings) {
    const urlsText = settings.referenceUrls.length > 0 ? settings.referenceUrls.map(url => `- ${url}`).join('\n') : '指定なし';
    return `あなたは指定された専門分野の専門家です。
以下の質問に対して、後述する設定に基づいて、正確かつ分かりやすい回答を作成してください。

--- 質問内容 ---
${settings.question || '（質問が入力されていません）'}\n--------------------

設定:
- **専門分野**: ${settings.expertise || '一般的な知識'}
- **望ましい回答形式**: ${settings.outputFormat || '指定なし'}
- **緊急度**: ${settings.urgency || '指定なし'}
- **前提情報・文脈**: ${settings.assumptions || '指定なし'}
- **参照情報**:
${urlsText}

以上の情報を用いて、質の高い回答を作成してください。`;
}


// --- イベントリスナー設定 ---

// APIキー/モデル選択の保存
apiKeyInput.addEventListener('change', () => localStorage.setItem('geminiApiKey', apiKeyInput.value));
modelSelector.addEventListener('change', () => localStorage.setItem('selectedModel', modelSelector.value));
updateModelsBtn.addEventListener('click', updateModelList);

// ★新機能: タブ切替
replyModeTab.addEventListener('click', () => switchMode('reply'));
questionModeTab.addEventListener('click', () => switchMode('question'));

// ★新機能: プロンプト表示切替
togglePromptBtn.addEventListener('click', togglePromptVisibility);

// URLフィールド管理 (返信モード)
addUrlBtn.addEventListener('click', () => addUrlField(urlContainer));
urlContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-url-btn')) e.target.parentElement.remove();
});

// ★新機能: URLフィールド管理 (質問モード)
addUrlBtnQuestion.addEventListener('click', () => addUrlField(urlContainerQuestion));
urlContainerQuestion.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-url-btn')) e.target.parentElement.remove();
});


// 返信モードのUI要素のイベントリスナー
sentimentSlider.addEventListener('input', () => { sentimentValueSpan.textContent = sentimentSlider.value; });
politenessSlider.addEventListener('input', () => { politenessValueSpan.textContent = politenessSlider.value; });
otherRelationshipText.addEventListener('focus', () => { otherRelationshipRadio.checked = true; });

// ★★★ メインのAI生成ボタン (ロジック更新) ★★★
generateBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey || !modelSelector.value) {
        alert('APIキーを入力し、使用モデルを選択してください。');
        return;
    }

    let settings, prompt;
    // 現在のモードに応じて設定とプロンプトを取得
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
            body: JSON.stringify({
                prompt: prompt,
                apiKey: apiKey,
                modelName: settings.selectedModel
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.errorCode === 'QUOTA_EXCEEDED') {
                alert('選択したモデルの無料利用枠を使い切りました。別のモデルを選択して再度お試しください。');
                aiReplyBox.textContent = '利用枠の上限に達しました。モデルを変更してください。';
            } else {
                throw new Error(data.error || '不明なエラーが発生しました。');
            }
        } else {
            const aiReply = data.reply;
            aiReplyBox.textContent = aiReply;
            saveToHistory(settings, prompt, aiReply); // settingsにはmodeが含まれている
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


// --- 履歴関連の関数 (更新) ---

// ★更新: 履歴保存 (settingsにmodeが含まれる)
function saveToHistory(settings, prompt, aiReply) {
    let history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
    history.unshift({ settings, prompt, aiReply, timestamp: new Date().toISOString() });
    history = history.slice(0, MAX_HISTORY_COUNT);
    localStorage.setItem('promptHistory', JSON.stringify(history));
}

// ★更新: 履歴表示 (モードを表示)
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

        const modeLabel = item.settings.mode === 'question' ? '[質問]' : '[返答]';
        const previewText = (item.aiReply || '（応答なし）').substring(0, 100);

        const promptPreview = document.createElement('pre');
        promptPreview.innerHTML = `<strong>${modeLabel}</strong> ${previewText}...<br><small>Model: ${item.settings.selectedModel || 'N/A'}</small>`;

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
        historyItem.appendChild(promptPreview);
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

// ★更新: 履歴からの復元 (モードに応じて処理を分岐)
async function restoreFromHistory(index) {
    const history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
    const item = history[index];
    if (!item) return;

    const settings = item.settings;
    const mode = settings.mode || 'reply'; // 古い履歴データのためにデフォルト値を設定

    // 正しいモードに切り替え
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
    
    // プロンプトエリアを表示状態にする
    promptDisplayArea.classList.remove('hidden');
    togglePromptBtn.textContent = 'プロンプトを非表示';

    // モデルリストを更新し、保存されたモデルを選択
    await updateModelList();
    if(settings.selectedModel) modelSelector.value = settings.selectedModel;

    window.scrollTo(0, 0);
    alert('入力内容を履歴から復元しました。');
}

// --- 初期化処理 ---
(async () => {
    apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
    
    // ★更新: 両方のURLコンテナに初期フィールドを追加
    addUrlField(urlContainer);
    addUrlField(urlContainerQuestion);

    renderHistory();
    
    if (apiKeyInput.value) {
        await updateModelList();
    }
    
    // 初期モードを設定
    switchMode('reply');
})();