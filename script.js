import { GoogleAI } from "https://www.gstatic.com/ai/google-web-ai-client.js";

// DOM要素の取得
const apiKeyInput = document.getElementById('apiKey');
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
const generateReplyBtn = document.getElementById('generateReplyBtn');
const loader = document.getElementById('loader');
const generatedPrompt = document.getElementById('generatedPrompt');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const aiReplyBox = document.getElementById('aiReply');
const copyReplyBtn = document.getElementById('copyReplyBtn');
const historyContainer = document.getElementById('historyContainer');

const MAX_HISTORY_COUNT = 5;

// --- 初期化処理 ---
apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
addUrlField();
renderHistory();

// --- イベントリスナー ---
apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('geminiApiKey', apiKeyInput.value);
});

addUrlBtn.addEventListener('click', () => addUrlField());
urlContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-url-btn')) {
        e.target.parentElement.remove();
    }
});

sentimentSlider.addEventListener('input', () => { sentimentValueSpan.textContent = sentimentSlider.value; });
politenessSlider.addEventListener('input', () => { politenessValueSpan.textContent = politenessSlider.value; });
otherRelationshipText.addEventListener('focus', () => { otherRelationshipRadio.checked = true; });

generateReplyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('APIキーを入力してください。');
        return;
    }

    const settings = getCurrentSettings();
    const prompt = createPrompt(settings);
    generatedPrompt.textContent = prompt;

    loader.style.display = 'block';
    generateReplyBtn.disabled = true;
    aiReplyBox.textContent = 'AIが返信を生成中です...';

    try {
        const genAI = new GoogleAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro"});
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        aiReplyBox.textContent = text;
        saveToHistory(settings, prompt, text);
    } catch (error) {
        console.error('Error:', error);
        aiReplyBox.textContent = 'エラーが発生しました。APIキーや設定を確認してください。';
        alert('エラーが発生しました。詳細はコンソールを確認してください。');
    } finally {
        loader.style.display = 'none';
        generateReplyBtn.disabled = false;
        renderHistory();
    }
});

copyPromptBtn.addEventListener('click', () => copyToClipboard(generatedPrompt.textContent, copyPromptBtn, 'プロンプトをコピー'));
copyReplyBtn.addEventListener('click', () => copyToClipboard(aiReplyBox.textContent, copyReplyBtn, '返信をコピー'));

// --- 関数定義 ---
function addUrlField(url = '') {
    const div = document.createElement('div');
    div.className = 'url-item';
    div.innerHTML = `
        <input type="text" class="url-input" value="${url}" placeholder="https://example.com">
        <button type="button" class="remove-url-btn">削除</button>
    `;
    urlContainer.appendChild(div);
}

function copyToClipboard(text, button, originalText) {
    if (navigator.clipboard && text && !text.includes('ここに...')) {
        navigator.clipboard.writeText(text).then(() => {
            button.textContent = 'コピーしました！';
            setTimeout(() => { button.textContent = originalText; }, 2000);
        });
    }
}

function getCurrentSettings() {
    let relationship = document.querySelector('input[name="relationship"]:checked').value;
    if (relationship === 'other') {
        relationship = otherRelationshipText.value || 'その他';
    }
    const urlInputs = Array.from(urlContainer.querySelectorAll('.url-input')).map(input => input.value.trim()).filter(url => url);
    return {
        receivedMessage: receivedMessage.value,
        userRole: userRole.value,
        relationship: relationship,
        sentiment: sentimentSlider.value,
        politeness: politenessSlider.value,
        charCount: charCount.value,
        punctuation: document.querySelector('input[name="punctuation"]:checked').value,
        replyContent: replyContent.value,
        referenceUrls: urlInputs,
        relationshipRadio: document.querySelector('input[name="relationship"]:checked').id
    };
}

function createPrompt(settings) {
    const urlsText = settings.referenceUrls.length > 0 ? settings.referenceUrls.map(url => `- ${url}`).join('\n') : '指定なし';
    return `あなたは優秀なコピーライターです。\n以下のメッセージに対するLINEの返信文を、後述する設定に基づいて作成してください。\n\n--- 相手のメッセージ ---\n${settings.receivedMessage || '（メッセージが入力されていません）'}\n------------------------\n\n設定:\n-   **役割**: ${settings.userRole || '指定なし'}\n-   **相手との関係性**: ${settings.relationship || '指定なし'}\n-   **感情の方向性 (否定的/肯定的)**: ${settings.sentiment}\n-   **丁寧度**: ${settings.politeness}\n-   **返信の概算文字数**: ${settings.charCount || '指定なし'}\n-   **句読点**: ${settings.punctuation}\n-   **返信に含めるべき内容**: ${settings.replyContent || '指定なし'}\n-   **参照情報**:\n${urlsText}\n\n以上の情報を用いて、自然で適切な返信文を作成してください。`;
}

function saveToHistory(settings, prompt, aiReply) {
    let history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
    history.unshift({ settings, prompt, aiReply, timestamp: new Date().toISOString() });
    history = history.slice(0, MAX_HISTORY_COUNT);
    localStorage.setItem('promptHistory', JSON.stringify(history));
}

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
        const promptPreview = document.createElement('pre');
        promptPreview.innerHTML = `<strong>Prompt:</strong> ${item.prompt.substring(0, 100)}...<br><br><strong>Reply:</strong> ${(item.aiReply || '（返信なし）').substring(0, 100)}...`;
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

function restoreFromHistory(index) {
    const history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
    const item = history[index];
    if (!item) return;
    const settings = item.settings;
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
        settings.referenceUrls.forEach(url => addUrlField(url));
    } else {
        addUrlField();
    }
    generatedPrompt.textContent = item.prompt;
    aiReplyBox.textContent = item.aiReply;
    window.scrollTo(0, 0);
    alert('入力内容を履歴から復元しました。');
}
