let questionnaires = [];
let currentEditingQuestionnaire = null;
let currentPlayingQuestionnaire = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let partnerAnswers = [];
let questionnaireStartTime = 0;
let questionnaireRevealTimer = null;
let questionnaireInviting = false;
let questionnaireInvitingTimer = null;

async function loadQuestionnaireData() {
    const saved = await localforage.getItem(getStorageKey('questionnaires'));
    if (saved) questionnaires = saved;
    if (questionnaires.length === 0) {
        questionnaires = [
            {
                id: Date.now(),
                title: '初次见面',
                description: '让我们互相了解一下吧~',
                questions: [
                    {
                        id: 1,
                        text: '你最喜欢的颜色是？',
                        options: ['红色', '蓝色', '绿色', '黄色', '紫色']
                    },
                    {
                        id: 2,
                        text: '今天心情怎么样？',
                        options: ['非常开心', '一般般', '有点低落', '很烦躁']
                    },
                    {
                        id: 3,
                        text: '周末想做什么？',
                        options: ['出去玩', '宅在家里', '和朋友聚会', '看电影']
                    }
                ],
                createdAt: Date.now()
            }
        ];
        saveQuestionnaireData();
    }
}

function saveQuestionnaireData() {
    localforage.setItem(getStorageKey('questionnaires'), questionnaires);
}

function renderQuestionnaireList() {
    const list = document.getElementById('questionnaire-list');
    if (!list) return;
    
    if (questionnaires.length === 0) {
        list.innerHTML = `
            <div style="padding:24px 0; text-align:center; color:var(--text-secondary);">
                <i class="fas fa-clipboard-list" style="font-size:32px; opacity:0.4; margin-bottom:8px;"></i>
                <div style="font-size:14px; font-weight:600;">还没有问卷</div>
                <div style="font-size:12px; margin-top:4px;">点击上方按钮创建第一个问卷吧~</div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = questionnaires.map(q => {
        const date = new Date(q.createdAt).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        return `
            <div style="border:1px solid var(--border-color); background:var(--primary-bg); 
                border-radius:14px; padding:14px; margin-bottom:10px;">
                <div style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:6px;">${_esc(q.title)}</div>
                <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">
                    ${q.description ? _esc(q.description) : '暂无描述'}
                </div>
                <div style="font-size:11px; color:var(--text-secondary); opacity:0.6; margin-bottom:10px;">
                    ${q.questions.length} 个问题 · ${date}
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="modal-btn modal-btn-secondary" onclick="editQuestionnaire(${q.id})" style="padding:6px 10px; font-size:11px;">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="modal-btn modal-btn-secondary" onclick="playQuestionnaire(${q.id})" style="padding:6px 10px; font-size:11px; background:var(--accent-color); color:#fff; border:none;">
                        <i class="fas fa-play"></i> 开始
                    </button>
                    <button class="modal-btn modal-btn-secondary" onclick="deleteQuestionnaire(${q.id})" style="padding:6px 10px; font-size:11px; color:var(--questionnaire-partner-choice); border-color:rgba(var(--questionnaire-partner-choice-rgb),0.4);">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function _esc(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function openQuestionnaireEditor(questionnaire = null) {
    currentEditingQuestionnaire = questionnaire;
    const titleEl = document.getElementById('questionnaire-editor-title');
    const titleInput = document.getElementById('questionnaire-title-input');
    const descInput = document.getElementById('questionnaire-desc-input');
    const container = document.getElementById('question-list-container');
    
    if (questionnaire) {
        titleEl.textContent = '编辑问卷';
        titleInput.value = questionnaire.title;
        descInput.value = questionnaire.description || '';
    } else {
        titleEl.textContent = '新建问卷';
        titleInput.value = '';
        descInput.value = '';
    }
    
    container.innerHTML = '';
    const questions = questionnaire ? [...questionnaire.questions] : [];
    
    questions.forEach((q, idx) => {
        addQuestionToEditor(q, idx);
    });
    
    if (questions.length === 0) {
        addQuestionToEditor(null, 0);
    }
    
    showModal(document.getElementById('questionnaire-editor-modal'));
}

function addQuestionToEditor(question = null, index) {
    const container = document.getElementById('question-list-container');
    const qId = question ? question.id : Date.now() + index;
    const qText = question ? question.text : '';
    const options = question ? [...question.options] : ['选项1', '选项2'];
    
    const div = document.createElement('div');
    div.className = 'question-item';
    div.dataset.index = index;
    div.style.cssText = `
        border:1px solid var(--border-color); 
        background:var(--primary-bg); 
        border-radius:12px; 
        padding:12px; 
        margin-bottom:10px;
    `;
    
    let optionsHtml = options.map((opt, optIdx) => `
        <div style="display:flex; gap:8px; margin-bottom:6px;">
            <span style="font-size:12px; color:var(--text-secondary); flex-shrink:0; width:20px; text-align:center;">${optIdx + 1}.</span>
            <input type="text" class="modal-input" value="${_esc(opt)}" 
                style="flex:1; font-size:12px; padding:6px 8px;" 
                placeholder="输入选项内容" 
                oninput="updateQuestionOption(${qId}, ${optIdx}, this.value)">
            <button onclick="removeQuestionOption(this, ${qId})" 
                style="background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:0 6px;"
                title="删除选项">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
    
    div.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
            <span style="font-size:13px; font-weight:600; color:var(--accent-color);">问题 ${index + 1}</span>
            <input type="text" value="${_esc(qText)}" 
                style="flex:1; padding:6px 8px; border:1px solid var(--border-color); border-radius:8px; 
                       background:var(--secondary-bg); color:var(--text-primary); font-size:12px; outline:none;"
                placeholder="输入问题内容"
                oninput="updateQuestionText(${qId}, this.value)"
                data-qid="${qId}">
            <button onclick="duplicateQuestion(this)" 
                style="background:none; border:none; color:var(--accent-color); cursor:pointer; padding:0 6px;"
                title="复制此问题">
                <i class="fas fa-copy"></i>
            </button>
            <button onclick="removeQuestionFromEditor(this)" 
                style="background:none; border:none; color:var(--questionnaire-partner-choice); cursor:pointer; padding:0 6px;"
                title="删除问题">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="question-options">
            ${optionsHtml}
        </div>
        <button onclick="addOptionToQuestion(this)" 
            style="margin-top:6px; padding:4px 10px; font-size:11px; border:1px dashed var(--border-color); 
                   border-radius:6px; background:none; color:var(--text-secondary); cursor:pointer;">
            <i class="fas fa-plus"></i> 添加选项
        </button>
    `;
    
    container.appendChild(div);
}

function updateQuestionText(qId, text) {
    const q = getCurrentEditingQuestion(qId);
    if (q) q.text = text;
}

function updateQuestionOption(qId, optIdx, text) {
    const q = getCurrentEditingQuestion(qId);
    if (q && q.options[optIdx] !== undefined) {
        q.options[optIdx] = text;
    }
}

function getCurrentEditingQuestion(qId) {
    if (!currentEditingQuestionnaire) return null;
    return currentEditingQuestionnaire.questions.find(q => q.id === qId);
}

function addOptionToQuestion(btn) {
    const optionsContainer = btn.parentElement.querySelector('.question-options');
    const qId = parseInt(btn.parentElement.querySelector('input[type="text"]').dataset.qid) || Date.now();
    
    const optIdx = optionsContainer.children.length;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:8px; margin-bottom:6px;';
    div.innerHTML = `
        <span style="font-size:12px; color:var(--text-secondary); flex-shrink:0; width:20px; text-align:center;">${optIdx + 1}.</span>
        <input type="text" class="modal-input" 
            style="flex:1; font-size:12px; padding:6px 8px;" 
            placeholder="输入选项内容">
        <button onclick="removeQuestionOption(this)" 
            style="background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:0 6px;"
            title="删除选项">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    optionsContainer.appendChild(div);
    
    if (currentEditingQuestionnaire) {
        const q = currentEditingQuestionnaire.questions.find(q => q.id === qId);
        if (q) q.options.push('');
    }
}

function removeQuestionOption(btn) {
    const parent = btn.parentElement;
    const optionsContainer = parent.parentElement;
    if (optionsContainer.children.length <= 2) {
        showNotification('每个问题至少需要2个选项', 'warning');
        return;
    }
    parent.remove();
    
    optionsContainer.querySelectorAll('span:first-child').forEach((span, idx) => {
        span.textContent = `${idx + 1}.`;
    });
}

function removeQuestionFromEditor(btn) {
    const container = document.getElementById('question-list-container');
    if (container.children.length <= 1) {
        showNotification('问卷至少需要1个问题', 'warning');
        return;
    }
    btn.closest('.question-item').remove();
    
    container.querySelectorAll('.question-item').forEach((item, idx) => {
        item.dataset.index = idx;
        item.querySelector('span:first-child').textContent = `问题 ${idx + 1}`;
    });
}

function duplicateQuestion(btn) {
    const currentItem = btn.closest('.question-item');
    const currentInput = currentItem.querySelector('input[data-qid]');
    const qText = currentInput ? currentInput.value.trim() : '';
    const qId = currentInput ? parseInt(currentInput.dataset.qid) : Date.now();
    
    // 获取当前问题的所有选项
    const options = [];
    currentItem.querySelectorAll('.question-options input').forEach(input => {
        const optText = input.value.trim();
        if (optText) options.push(optText);
    });
    
    if (options.length < 2) {
        showNotification('复制问题需要至少2个选项', 'warning');
        return;
    }
    
    // 创建新问题数据
    const newQuestion = {
        id: Date.now(),
        text: qText,
        options: options
    };
    
    // 获取当前问题在容器中的索引
    const currentIndex = parseInt(currentItem.dataset.index);
    const newIndex = currentIndex + 1;
    
    // 创建新问题元素（临时插入到末尾）
    const container = document.getElementById('question-list-container');
    addQuestionToEditor(newQuestion, newIndex);
    
    // 将新创建的问题元素移动到当前问题之后
    const newItem = container.lastElementChild;
    container.removeChild(newItem);
    
    // 在当前问题之后插入
    if (currentItem.nextSibling) {
        container.insertBefore(newItem, currentItem.nextSibling);
    } else {
        container.appendChild(newItem);
    }
    
    // 更新所有问题的索引和编号
    container.querySelectorAll('.question-item').forEach((item, idx) => {
        item.dataset.index = idx;
        item.querySelector('span:first-child').textContent = `问题 ${idx + 1}`;
    });
    
    showNotification('问题已复制', 'success');
}

function saveQuestionnaire() {
    const title = document.getElementById('questionnaire-title-input').value.trim();
    const desc = document.getElementById('questionnaire-desc-input').value.trim();
    
    if (!title) {
        showNotification('请输入问卷标题', 'warning');
        return;
    }
    
    const container = document.getElementById('question-list-container');
    const questions = [];
    
    container.querySelectorAll('.question-item').forEach(item => {
        const qText = item.querySelector('input[type="text"]').value.trim();
        if (!qText) return;
        
        const options = [];
        item.querySelectorAll('.question-options input').forEach(input => {
            const optText = input.value.trim();
            if (optText) options.push(optText);
        });
        
        if (options.length >= 2) {
            questions.push({
                id: Date.now() + questions.length,
                text: qText,
                options: options
            });
        }
    });
    
    if (questions.length === 0) {
        showNotification('请添加至少一个问题', 'warning');
        return;
    }
    
    if (currentEditingQuestionnaire) {
        currentEditingQuestionnaire.title = title;
        currentEditingQuestionnaire.description = desc;
        currentEditingQuestionnaire.questions = questions;
    } else {
        questionnaires.push({
            id: Date.now(),
            title: title,
            description: desc,
            questions: questions,
            createdAt: Date.now()
        });
    }
    
    saveQuestionnaireData();
    renderQuestionnaireList();
    hideModal(document.getElementById('questionnaire-editor-modal'));
    showNotification('问卷已保存', 'success');
}

function editQuestionnaire(id) {
    const q = questionnaires.find(item => item.id === id);
    if (q) {
        openQuestionnaireEditor(q);
    }
}

function deleteQuestionnaire(id) {
    if (!confirm('确定要删除这个问卷吗？')) return;
    questionnaires = questionnaires.filter(q => q.id !== id);
    saveQuestionnaireData();
    renderQuestionnaireList();
    showNotification('问卷已删除', 'success');
}

function playQuestionnaire(id) {
    if (questionnaireInviting) {
        showNotification('请稍候，对方正在查看...', 'warning');
        return;
    }
    
    const q = questionnaires.find(item => item.id === id);
    if (!q) return;
    
    questionnaireInviting = true;
    
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
    
    const listContent = document.getElementById('questionnaire-list');
    
    listContent.innerHTML = `
        <div style="padding:40px 20px; text-align:center;">
            <div style="width:64px; height:64px; border-radius:50%; background:rgba(var(--questionnaire-partner-choice-rgb), 0.1); 
                        display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
                <div style="width:28px; height:28px; border-radius:50%; background:var(--questionnaire-partner-choice); 
                            display:flex; align-items:center; justify-content:center; color:#fff;">
                    <i class="fas fa-user"></i>
                </div>
            </div>
            <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:6px;">${_esc(partnerName)} 正在查看问卷...</div>
            <div style="display:flex; justify-content:center; gap:4px;">
                <span style="width:6px; height:6px; border-radius:50%; background:var(--questionnaire-partner-choice); opacity:0.6; animation:bounce 1.4s infinite ease-in-out both;"></span>
                <span style="width:6px; height:6px; border-radius:50%; background:var(--questionnaire-partner-choice); opacity:0.6; animation:bounce 1.4s infinite ease-in-out both; animation-delay:0.16s;"></span>
                <span style="width:6px; height:6px; border-radius:50%; background:var(--questionnaire-partner-choice); opacity:0.6; animation:bounce 1.4s infinite ease-in-out both; animation-delay:0.32s;"></span>
            </div>
            <style>
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
            </style>
        </div>
    `;
    
    const delayMin = 1500;
    const delayMax = 2500;
    const delay = delayMin + Math.random() * (delayMax - delayMin);
    
    questionnaireInvitingTimer = setTimeout(() => {
        questionnaireInviting = false;
        questionnaireInvitingTimer = null;
        
        if (Math.random() < 0.5) {
            listContent.innerHTML = `
                <div style="padding:40px 20px; text-align:center;">
                    <div style="width:64px; height:64px; border-radius:50%; background:rgba(var(--questionnaire-partner-choice-rgb), 0.1); 
                                display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
                        <div style="width:28px; height:28px; border-radius:50%; background:var(--questionnaire-partner-choice); 
                                    display:flex; align-items:center; justify-content:center; color:#fff;">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                    <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:6px;">${_esc(partnerName)} 拒绝了你的问卷邀请</div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:20px;">也许下次会接受呢~</div>
                    <button class="modal-btn modal-btn-primary" onclick="renderQuestionnaireList()" style="padding:8px 24px;">
                        返回问卷列表
                    </button>
                </div>
            `;
        } else {
            currentPlayingQuestionnaire = q;
            currentQuestionIndex = 0;
            userAnswers = [];
            partnerAnswers = [];
            questionnaireStartTime = Date.now();
            
            document.getElementById('questionnaire-play-title').textContent = q.title;
            hideModal(document.getElementById('questionnaire-modal'));
            showModal(document.getElementById('questionnaire-play-modal'));
            renderCurrentQuestion();
        }
    }, delay);
}

function renderCurrentQuestion() {
    const content = document.getElementById('questionnaire-play-content');
    const nextBtn = document.getElementById('questionnaire-next-btn');
    const finishBtn = document.getElementById('questionnaire-finish-btn');
    const backBtn = document.getElementById('back-to-questionnaire-list');
    
    const q = currentPlayingQuestionnaire;
    const question = q.questions[currentQuestionIndex];
    
    content.innerHTML = `
        <div style="margin-bottom:8px; font-size:12px; color:var(--text-secondary);">
            第 ${currentQuestionIndex + 1} / ${q.questions.length} 题
        </div>
        <div style="font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:20px; line-height:1.5;">
            ${_esc(question.text)}
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
            ${question.options.map((opt, idx) => `
                <button class="questionnaire-option-btn" data-index="${idx}" 
                    onclick="selectOption(${idx})"
                    style="padding:14px 16px; text-align:left; border:2px solid var(--border-color); 
                           border-radius:14px; background:var(--primary-bg); color:var(--text-primary); 
                           font-size:14px; cursor:pointer; transition:all 0.25s; font-family:var(--font-family);">
                    <span style="display:inline-flex; align-items:center; justify-content:center; 
                                 width:24px; height:24px; border-radius:50%; background:var(--secondary-bg); 
                                 color:var(--text-secondary); font-size:12px; font-weight:600; margin-right:12px;">
                        ${idx + 1}
                    </span>
                    ${_esc(opt)}
                </button>
            `).join('')}
        </div>
    `;
    
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';
    backBtn.style.display = 'block';
}

function selectOption(optIndex) {
    if (questionnaireRevealTimer) return;
    
    const q = currentPlayingQuestionnaire;
    const question = q.questions[currentQuestionIndex];
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
    
    userAnswers[currentQuestionIndex] = {
        questionId: question.id,
        questionText: question.text,
        answerIndex: optIndex,
        answerText: question.options[optIndex]
    };
    
    const partnerOptIndex = getRandomOptionIndex(question.options);
    partnerAnswers[currentQuestionIndex] = {
        questionId: question.id,
        questionText: question.text,
        answerIndex: partnerOptIndex,
        answerText: question.options[partnerOptIndex]
    };
    
    const buttons = document.querySelectorAll('.questionnaire-option-btn');
    
    buttons.forEach((btn, idx) => {
        btn.disabled = true;
        if (idx === optIndex) {
            btn.style.borderColor = 'var(--questionnaire-user-choice)';
            btn.style.background = 'rgba(var(--questionnaire-user-choice-rgb), 0.1)';
            btn.innerHTML = `
                <span style="display:inline-flex; align-items:center; justify-content:center; 
                             width:24px; height:24px; border-radius:50%; background:var(--questionnaire-user-choice); 
                             color:#fff; font-size:12px; font-weight:600; margin-right:12px;">
                    <i class="fas fa-check" style="font-size:12px;"></i>
                </span>
                ${_esc(question.options[idx])} <span style="color:var(--questionnaire-user-choice); font-weight:600;">(你)</span>
            `;
        }
    });
    
    const thinkingDiv = document.createElement('div');
    thinkingDiv.id = 'questionnaire-thinking';
    thinkingDiv.style.cssText = `
        margin-top:16px; padding:12px 16px; 
        background:rgba(var(--questionnaire-partner-choice-rgb), 0.08);
        border:1px solid rgba(var(--questionnaire-partner-choice-rgb), 0.2); 
        border-radius:12px;
        display:flex; align-items:center; gap:10px;
        animation:fadeInUp 0.3s ease-out;
    `;
    thinkingDiv.innerHTML = `
        <style>@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}</style>
        <div style="width:28px; height:28px; border-radius:50%; background:var(--questionnaire-partner-choice); 
                    display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px; flex-shrink:0;">
            <i class="fas fa-user"></i>
        </div>
        <div style="flex:1;">
            <div style="font-size:13px; font-weight:600; color:var(--questionnaire-partner-choice); margin-bottom:4px;">
                ${_esc(partnerName)} 正在选择...
            </div>
            <div style="display:flex; gap:4px;">
                <span style="width:6px; height:6px; border-radius:50%; background:var(--questionnaire-partner-choice); opacity:0.6; animation:bounce 1.4s infinite ease-in-out both;"></span>
                <span style="width:6px; height:6px; border-radius:50%; background:var(--questionnaire-partner-choice); opacity:0.6; animation:bounce 1.4s infinite ease-in-out both; animation-delay:0.16s;"></span>
                <span style="width:6px; height:6px; border-radius:50%; background:var(--questionnaire-partner-choice); opacity:0.6; animation:bounce 1.4s infinite ease-in-out both; animation-delay:0.32s;"></span>
            </div>
        </div>
        <style>
            @keyframes bounce {
                0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                40% { transform: scale(1); opacity: 1; }
            }
        </style>
    `;
    
    const content = document.getElementById('questionnaire-play-content');
    content.appendChild(thinkingDiv);
    
    const delayMin = (typeof settings !== 'undefined' && settings.questionnaireDelayMin) || 1000;
    const delayMax = (typeof settings !== 'undefined' && settings.questionnaireDelayMax) || 3000;
    const delayRange = delayMax - delayMin;
    const randomDelay = delayMin + Math.random() * delayRange;
    
    questionnaireRevealTimer = setTimeout(() => {
        questionnaireRevealTimer = null;
        
        if (thinkingDiv.parentNode) {
            thinkingDiv.remove();
        }
        
        buttons.forEach((btn, idx) => {
            if (idx === partnerOptIndex) {
                btn.style.borderColor = 'var(--questionnaire-partner-choice)';
                btn.style.background = 'rgba(var(--questionnaire-partner-choice-rgb), 0.1)';
                btn.innerHTML = `
                    <span style="display:inline-flex; align-items:center; justify-content:center; 
                                 width:24px; height:24px; border-radius:50%; background:var(--questionnaire-partner-choice); 
                                 color:#fff; font-size:12px; font-weight:600; margin-right:12px;">
                        <i class="fas fa-heart" style="font-size:12px;"></i>
                    </span>
                    ${_esc(question.options[idx])} <span style="color:var(--questionnaire-partner-choice); font-weight:600;">(${partnerName})</span>
                `;
            }
        });
        
        const nextBtn = document.getElementById('questionnaire-next-btn');
        const finishBtn = document.getElementById('questionnaire-finish-btn');
        
        if (currentQuestionIndex < q.questions.length - 1) {
            nextBtn.style.display = 'inline-flex';
        } else {
            finishBtn.style.display = 'inline-flex';
        }
    }, randomDelay);
}

function getRandomOptionIndex(options) {
    if (options.length <= 1) return 0;
    return Math.floor(Math.random() * options.length);
}

function showPartnerAnswer() {
    const q = currentPlayingQuestionnaire;
    const question = q.questions[currentQuestionIndex];
    const partnerAnswer = partnerAnswers[currentQuestionIndex];
    
    const content = document.getElementById('questionnaire-play-content');
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
    
    const partnerDiv = document.createElement('div');
    partnerDiv.style.cssText = `
        margin-top:16px; padding:14px; background:linear-gradient(135deg, rgba(var(--questionnaire-partner-choice-rgb),0.08), rgba(var(--questionnaire-partner-choice-rgb),0.02));
        border:1px solid rgba(var(--questionnaire-partner-choice-rgb),0.2); border-radius:14px;
        animation:fadeInUp 0.4s ease-out;
    `;
    
    partnerDiv.innerHTML = `
        <style>@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}</style>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <div style="width:28px; height:28px; border-radius:50%; background:var(--questionnaire-partner-choice); 
                        display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;">
                <i class="fas fa-user"></i>
            </div>
            <span style="font-size:13px; font-weight:600; color:var(--questionnaire-partner-choice);">${_esc(partnerName)} 的选择</span>
        </div>
        <div style="font-size:14px; color:var(--text-primary); padding-left:36px;">
            <span style="display:inline-flex; align-items:center; justify-content:center; 
                         width:20px; height:20px; border-radius:50%; background:var(--questionnaire-partner-choice); 
                         color:#fff; font-size:10px; font-weight:600; margin-right:8px;">
                ${partnerAnswer.answerIndex + 1}
            </span>
            ${_esc(partnerAnswer.answerText)}
        </div>
    `;
    
    content.appendChild(partnerDiv);
    
    const nextBtn = document.getElementById('questionnaire-next-btn');
    const finishBtn = document.getElementById('questionnaire-finish-btn');
    
    if (currentQuestionIndex < q.questions.length - 1) {
        nextBtn.style.display = 'inline-flex';
    } else {
        finishBtn.style.display = 'inline-flex';
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    renderCurrentQuestion();
}

function showQuestionnaireResult() {
    const content = document.getElementById('questionnaire-play-content');
    const nextBtn = document.getElementById('questionnaire-next-btn');
    const finishBtn = document.getElementById('questionnaire-finish-btn');
    const backBtn = document.getElementById('back-to-questionnaire-list');
    
    const myName = (typeof settings !== 'undefined' && settings.myName) || '我';
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
    
    const totalTime = Date.now() - questionnaireStartTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    let timeText = '';
    if (minutes > 0) {
        timeText = `${minutes}分${seconds}秒`;
    } else {
        timeText = `${seconds}秒`;
    }
    
    const resultsHtml = userAnswers.map((ua, idx) => {
        const pa = partnerAnswers[idx];
        
        return `
            <div style="border:1px solid var(--border-color); background:var(--primary-bg); 
                        border-radius:14px; padding:14px; margin-bottom:12px;">
                <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:10px;">
                    Q${idx + 1}: ${_esc(ua.questionText)}
                </div>
                <div style="display:flex; gap:12px;">
                    <div style="flex:1; padding:10px; background:rgba(var(--questionnaire-user-choice-rgb),0.06); 
                                border-radius:10px; border-left:3px solid var(--questionnaire-user-choice);">
                        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">${_esc(myName)}</div>
                        <div style="font-size:13px; color:var(--text-primary); font-weight:500;">${_esc(ua.answerText)}</div>
                    </div>
                    <div style="flex:1; padding:10px; background:rgba(var(--questionnaire-partner-choice-rgb),0.06); 
                                border-radius:10px; border-left:3px solid var(--questionnaire-partner-choice);">
                        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">${_esc(partnerName)}</div>
                        <div style="font-size:13px; color:var(--text-primary); font-weight:500;">${_esc(pa.answerText)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    content.innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:18px; font-weight:800; color:var(--text-primary); margin-bottom:4px;">
                作答用时：${timeText}
            </div>
            <div style="font-size:13px; color:var(--text-secondary);">共 ${userAnswers.length} 道题</div>
        </div>
        ${resultsHtml}
    `;
    
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';
    backBtn.textContent = '返回列表';
}

function initQuestionnaireListeners() {
    const entryBtn = document.getElementById('questionnaire-function');
    if (entryBtn) {
        entryBtn.addEventListener('click', async () => {
            hideModal(document.getElementById('advanced-modal'));
            await loadQuestionnaireData();
            renderQuestionnaireList();
            showModal(document.getElementById('questionnaire-modal'));
        });
    }
    
    const closeBtn = document.getElementById('close-questionnaire');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (questionnaireInvitingTimer) {
                clearTimeout(questionnaireInvitingTimer);
                questionnaireInvitingTimer = null;
            }
            questionnaireInviting = false;
            hideModal(document.getElementById('questionnaire-modal'));
        });
    }
    
    const addBtn = document.getElementById('add-question-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openQuestionnaireEditor();
        });
    }
    
    const cancelEditorBtn = document.getElementById('cancel-questionnaire-editor');
    if (cancelEditorBtn) {
        cancelEditorBtn.addEventListener('click', () => {
            hideModal(document.getElementById('questionnaire-editor-modal'));
        });
    }
    
    const saveBtn = document.getElementById('save-questionnaire-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveQuestionnaire);
    }
    
    const addQuestionItemBtn = document.getElementById('add-question-item-btn');
    if (addQuestionItemBtn) {
        addQuestionItemBtn.addEventListener('click', () => {
            const container = document.getElementById('question-list-container');
            addQuestionToEditor(null, container.children.length);
        });
    }
    
    const nextBtn = document.getElementById('questionnaire-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', nextQuestion);
    }
    
    const finishBtn = document.getElementById('questionnaire-finish-btn');
    if (finishBtn) {
        finishBtn.addEventListener('click', showQuestionnaireResult);
    }
    
    const backToListBtn = document.getElementById('back-to-questionnaire-list');
    if (backToListBtn) {
        backToListBtn.addEventListener('click', () => {
            if (questionnaireRevealTimer) {
                clearTimeout(questionnaireRevealTimer);
                questionnaireRevealTimer = null;
            }
            hideModal(document.getElementById('questionnaire-play-modal'));
            renderQuestionnaireList();
            showModal(document.getElementById('questionnaire-modal'));
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initQuestionnaireListeners();
});