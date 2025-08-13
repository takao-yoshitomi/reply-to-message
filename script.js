document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
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
    const generatePromptBtn = document.getElementById('generatePrompt');
    const copyPromptBtn = document.getElementById('copyPromptBtn');
    const generatedPrompt = document.getElementById('generatedPrompt');
    const historyContainer = document.getElementById('historyContainer');

    const MAX_HISTORY_COUNT = 5;

    // --- URLフィールド管理 ---
    const addUrlField = (url = '') => {
        const div = document.createElement('div');
        div.className = 'url-item';
        div.innerHTML = `
            <input type="text" class="url-input" value="${url}" placeholder="https://example.com">
            <button type="button" class="remove-url-btn">削除</button>
        `;
        urlContainer.appendChild(div);
    };

    addUrlBtn.addEventListener('click', () => addUrlField());

    urlContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-url-btn')) {
            e.target.parentElement.remove();
        }
    });

    // --- イベントリスナーの設定 ---
    sentimentSlider.addEventListener('input', () => { sentimentValueSpan.textContent = sentimentSlider.value; });
    politenessSlider.addEventListener('input', () => { politenessValueSpan.textContent = politenessValueSpan.value; });
    otherRelationshipText.addEventListener('focus', () => { otherRelationshipRadio.checked = true; });

    generatePromptBtn.addEventListener('click', () => {
        const settings = getCurrentSettings();
        const prompt = createPrompt(settings);
        generatedPrompt.textContent = prompt;
        saveToHistory(settings, prompt);
        renderHistory();
    });

    copyPromptBtn.addEventListener('click', () => {
        const promptText = generatedPrompt.textContent;
        if (navigator.clipboard && promptText && !promptText.includes('ここにプロンプトが表示されます...')) {
            navigator.clipboard.writeText(promptText).then(() => {
                copyPromptBtn.textContent = 'コピーしました！';
                setTimeout(() => { copyPromptBtn.textContent = 'クリップボードにコピー'; }, 2000);
            });
        }
    });

    // --- 関数定義 ---
    const getCurrentSettings = () => {
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
    };

    const createPrompt = (settings) => {
        const urlsText = settings.referenceUrls.length > 0 ? settings.referenceUrls.map(url => `- ${url}`).join('\n') : '指定なし';

        return `あなたは優秀なコピーライターです。
以下のメッセージに対するLINEの返信文を、後述する設定に基づいて作成してください。

--- 相手のメッセージ ---
${settings.receivedMessage || '（メッセージが入力されていません）'}
------------------------

設定:
-   **役割**: ${settings.userRole || '指定なし'}
-   **相手との関係性**: ${settings.relationship || '指定なし'}
-   **感情の方向性 (否定的/肯定的)**: ${settings.sentiment}
-   **丁寧度**: ${settings.politeness}
-   **返信の概算文字数**: ${settings.charCount || '指定なし'}
-   **句読点**: ${settings.punctuation}
-   **返信に含めるべき内容**: ${settings.replyContent || '指定なし'}
-   **参照情報**:
${urlsText}

以上の情報を用いて、自然で適切な返信文を作成してください。`;
    };

    const saveToHistory = (settings, prompt) => {
        let history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
        history.unshift({ settings, prompt, timestamp: new Date().toISOString() });
        history = history.slice(0, MAX_HISTORY_COUNT);
        localStorage.setItem('promptHistory', JSON.stringify(history));
    };

    const renderHistory = () => {
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
            promptPreview.textContent = item.prompt.substring(0, 150) + '...';
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
    };

    const deleteFromHistory = (index) => {
        if (!confirm('この履歴を本当に削除しますか？')) return;
        let history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
        history.splice(index, 1); // 配列から指定されたインデックスの要素を削除
        localStorage.setItem('promptHistory', JSON.stringify(history));
        renderHistory(); // 履歴表示を更新
    };

    const restoreFromHistory = (index) => {
        const history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
        const item = history[index];
        if (!item) return;

        const settings = item.settings;
        receivedMessage.value = settings.receivedMessage;
        userRole.value = settings.userRole;
        sentimentSlider.value = settings.sentiment;
        sentimentValueSpan.textContent = settings.sentiment;
        politenessSlider.value = settings.politeness;
        politenessValueSpan.textContent = settings.politeness; // Bug fix: was politenessValue
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
        window.scrollTo(0, 0);
        alert('入力内容を履歴から復元しました。');
    };

    // --- 初期化処理 ---
    addUrlField(); // 最初のURLフィールドを1つ作成
    renderHistory();
});
