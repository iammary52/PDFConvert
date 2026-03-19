/**
 * PDF 변환기 - Frontend JavaScript (Static / GitHub Pages)
 * CloudConvert API v2 직접 호출 (서버 불필요)
 */

const ALLOWED_EXTENSIONS = ['doc', 'docx', 'hwp', 'hwpx', 'ppt', 'pptx'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const CLOUDCONVERT_API = 'https://api.cloudconvert.com/v2';

const FILE_COLORS = {
    doc: '#2B5CE6', docx: '#2B5CE6',
    hwp: '#0D9488', hwpx: '#0D9488',
    ppt: '#DC2626', pptx: '#DC2626'
};
const FILE_LABELS = {
    doc: 'DOC', docx: 'DOCX',
    hwp: 'HWP', hwpx: 'HWPX',
    ppt: 'PPT', pptx: 'PPTX'
};

let pendingFiles = [];

// DOM Elements
const dropZone        = document.getElementById('dropZone');
const fileInput       = document.getElementById('fileInput');
const fileQueue       = document.getElementById('fileQueue');
const fileList        = document.getElementById('fileList');
const convertBtn      = document.getElementById('convertBtn');
const clearBtn        = document.getElementById('clearBtn');
const progressSection = document.getElementById('progressSection');
const progressList    = document.getElementById('progressList');
const resultsSection  = document.getElementById('resultsSection');
const resultsList     = document.getElementById('resultsList');
const resetBtn        = document.getElementById('resetBtn');
const toastContainer  = createToastContainer();

// ===========================
// API Key Management
// ===========================
function getApiKey() {
    return localStorage.getItem('cloudconvert_api_key') || '';
}

function saveApiKey(key) {
    localStorage.setItem('cloudconvert_api_key', key.trim());
}

function clearApiKey() {
    localStorage.removeItem('cloudconvert_api_key');
}

// Settings Modal
const settingsBtn   = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const modalClose    = document.getElementById('modalClose');
const apiKeyInput   = document.getElementById('apiKeyInput');
const saveKeyBtn    = document.getElementById('saveKeyBtn');
const clearKeyBtn   = document.getElementById('clearKeyBtn');
const toggleKey     = document.getElementById('toggleKey');
const apiKeyStatus  = document.getElementById('apiKeyStatus');

settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = getApiKey();
    updateApiKeyStatus();
    settingsModal.style.display = 'flex';
});

modalClose.addEventListener('click', () => settingsModal.style.display = 'none');
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.style.display = 'none';
});

toggleKey.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    toggleKey.textContent = apiKeyInput.type === 'password' ? '보기' : '숨기기';
});

saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) { showApiKeyStatus('API 키를 입력해주세요.', 'error'); return; }
    saveApiKey(key);
    showApiKeyStatus('API 키가 저장되었습니다.', 'success');
    setTimeout(() => settingsModal.style.display = 'none', 1000);
});

clearKeyBtn.addEventListener('click', () => {
    clearApiKey();
    apiKeyInput.value = '';
    showApiKeyStatus('API 키가 삭제되었습니다.', 'error');
});

function showApiKeyStatus(msg, type) {
    apiKeyStatus.textContent = msg;
    apiKeyStatus.className = 'api-key-status ' + type;
}

function updateApiKeyStatus() {
    const key = getApiKey();
    if (key) showApiKeyStatus('API 키가 설정되어 있습니다.', 'success');
    else     showApiKeyStatus('API 키가 설정되지 않았습니다.', 'error');
}

// 페이지 로드 시 키 없으면 모달 자동 표시
window.addEventListener('load', () => {
    if (!getApiKey()) settingsModal.style.display = 'flex';
});

// ===========================
// Toast System
// ===========================
function createToastContainer() {
    const div = document.createElement('div');
    div.className = 'toast-container';
    document.body.appendChild(div);
    return div;
}

function showToast(message, type = 'default', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', default: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || icons.default}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===========================
// File Utilities
// ===========================
function getExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isValidFile(file) {
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        showToast(`"${file.name}" - 지원하지 않는 파일 형식입니다.`, 'error');
        return false;
    }
    if (file.size > MAX_FILE_SIZE) {
        showToast(`"${file.name}" - 파일 크기가 50MB를 초과합니다.`, 'error');
        return false;
    }
    return true;
}

// ===========================
// File Management
// ===========================
function addFiles(files) {
    const newFiles = Array.from(files).filter(isValidFile);
    newFiles.forEach(file => {
        const isDupe = pendingFiles.some(f => f.name === file.name && f.size === file.size);
        if (!isDupe) pendingFiles.push(file);
        else showToast(`"${file.name}" - 이미 목록에 있습니다.`, 'warning');
    });
    renderFileList();
    if (pendingFiles.length > 0) {
        document.getElementById('dropContent').style.display = 'none';
        fileQueue.style.display = 'block';
    }
}

function renderFileList() {
    fileList.innerHTML = '';
    pendingFiles.forEach((file, index) => {
        const ext   = getExtension(file.name);
        const color = FILE_COLORS[ext] || '#6B7280';
        const label = FILE_LABELS[ext] || ext.toUpperCase();
        const item  = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-type-badge" style="background:${color}">${label}</div>
            <div class="file-info">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="file-remove" data-index="${index}" title="제거">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        `;
        fileList.appendChild(item);
    });
    fileList.querySelectorAll('.file-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingFiles.splice(parseInt(btn.dataset.index), 1);
            if (pendingFiles.length === 0) resetToUpload();
            else renderFileList();
        });
    });
}

function resetToUpload() {
    pendingFiles = [];
    fileInput.value = '';
    document.getElementById('dropContent').style.display = 'block';
    fileQueue.style.display = 'none';
    progressSection.style.display = 'none';
    resultsSection.style.display = 'none';
    dropZone.style.display = 'block';
}

// ===========================
// Drag & Drop
// ===========================
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
});
dropZone.addEventListener('click', (e) => {
    if (!e.target.closest('label') && !e.target.closest('input')) fileInput.click();
});
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) addFiles(fileInput.files);
});
clearBtn.addEventListener('click', resetToUpload);
resetBtn.addEventListener('click', resetToUpload);

// ===========================
// Conversion (CloudConvert API 직접 호출)
// ===========================
convertBtn.addEventListener('click', startConversion);

async function startConversion() {
    if (pendingFiles.length === 0) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('먼저 CloudConvert API 키를 설정해주세요.', 'error');
        settingsModal.style.display = 'flex';
        return;
    }

    fileQueue.style.display = 'none';
    dropZone.style.display = 'none';
    progressSection.style.display = 'block';
    progressList.innerHTML = '';

    const results = [];
    for (const file of pendingFiles) {
        const progressItem = createProgressItem(file.name);
        progressList.appendChild(progressItem);
        try {
            const pdfUrl = await convertFile(file, progressItem, apiKey);
            results.push({ name: file.name, pdfUrl, success: true });
            setProgressDone(progressItem);
        } catch (err) {
            results.push({ name: file.name, error: err.message, success: false });
            setProgressError(progressItem, err.message);
        }
    }
    setTimeout(() => showResults(results), 600);
}

async function convertFile(file, progressItem, apiKey) {
    const ext = getExtension(file.name);

    setProgressStatus(progressItem, 'uploading', '작업 생성 중...');

    // 변환 태스크 설정 (HWP는 libreoffice 엔진)
    const convertTask = {
        operation: 'convert',
        input: ['upload-task'],
        output_format: 'pdf',
        ...(ext === 'hwp' || ext === 'hwpx' ? { engine: 'libreoffice' } : {})
    };

    // 1. CloudConvert Job 생성
    const jobRes = await fetch(`${CLOUDCONVERT_API}/jobs`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tasks: {
                'upload-task':  { operation: 'import/upload' },
                'convert-task': convertTask,
                'export-task':  {
                    operation: 'export/url',
                    input: ['convert-task'],
                    inline: false,
                    archive_multiple_files: false
                }
            }
        })
    });

    const jobData = await jobRes.json();
    if (!jobRes.ok) {
        const msg = jobData.message || (jobData.errors ? Object.values(jobData.errors).flat().join(', ') : 'API 오류');
        throw new Error(msg);
    }

    const jobId      = jobData.data.id;
    const uploadTask = jobData.data.tasks.find(t => t.name === 'upload-task');
    if (!uploadTask?.result?.form) throw new Error('업로드 URL을 가져오지 못했습니다.');

    // 2. 파일을 S3에 직접 업로드
    setProgressStatus(progressItem, 'uploading', '업로드 중...');
    const formData = new FormData();
    Object.entries(uploadTask.result.form.parameters).forEach(([k, v]) => formData.append(k, v));
    formData.append('file', file);

    const uploadRes = await fetch(uploadTask.result.form.url, { method: 'POST', body: formData });
    if (!uploadRes.ok && uploadRes.status !== 204) {
        throw new Error(`파일 업로드 실패 (HTTP ${uploadRes.status})`);
    }

    // 3. 변환 완료 대기
    setProgressStatus(progressItem, 'converting', '변환 중...');
    return await pollJobStatus(jobId, apiKey, 0);
}

async function pollJobStatus(jobId, apiKey, attempts) {
    if (attempts > 60) throw new Error('변환 시간이 초과되었습니다. 다시 시도해주세요.');

    await sleep(3000);

    const res  = await fetch(`${CLOUDCONVERT_API}/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '상태 확인 오류');

    const job = data.data;

    if (job.status === 'finished') {
        const exportTask  = job.tasks.find(t => t.name === 'export-task');
        const downloadUrl = exportTask?.result?.files?.[0]?.url;
        if (!downloadUrl) throw new Error('PDF 다운로드 URL을 찾을 수 없습니다.');
        return downloadUrl;
    }

    if (job.status === 'error') {
        const failedTask = job.tasks.find(t => t.status === 'error');
        throw new Error(failedTask?.message || '변환 중 오류가 발생했습니다.');
    }

    return pollJobStatus(jobId, apiKey, attempts + 1);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===========================
// Progress UI
// ===========================
function createProgressItem(filename) {
    const div = document.createElement('div');
    div.className = 'progress-item';
    div.innerHTML = `
        <div class="progress-header">
            <div class="progress-file-name" title="${filename}">${filename}</div>
            <div class="progress-status">대기 중...</div>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar"></div>
        </div>
    `;
    return div;
}

function setProgressStatus(item, status, text) {
    item.querySelector('.progress-bar').className = `progress-bar ${status}`;
    item.querySelector('.progress-status').textContent = text;
}

function setProgressDone(item) {
    setProgressStatus(item, 'done', '완료 ✓');
    item.querySelector('.progress-status').style.color = '#10B981';
}

function setProgressError(item, msg) {
    setProgressStatus(item, 'error', '실패 ✕');
    item.querySelector('.progress-status').style.color = '#EF4444';
}

// ===========================
// Results
// ===========================
function showResults(results) {
    progressSection.style.display = 'none';
    resultsSection.style.display = 'block';
    resultsList.innerHTML = '';

    const successCount = results.filter(r => r.success).length;
    const failCount    = results.filter(r => !r.success).length;

    results.forEach(result => {
        const item = document.createElement('div');
        if (result.success) {
            const pdfName = result.name.replace(/\.(doc|docx|hwp|hwpx|ppt|pptx)$/i, '.pdf');
            item.className = 'result-item';
            item.innerHTML = `
                <div class="result-info">
                    <div class="result-icon">PDF</div>
                    <div>
                        <div class="result-name">${pdfName}</div>
                        <div class="result-sub">변환 완료</div>
                    </div>
                </div>
                <a href="${result.pdfUrl}" download="${pdfName}" class="btn-download" target="_blank">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    다운로드
                </a>
            `;
        } else {
            item.className = 'result-item error-item';
            item.innerHTML = `
                <div class="result-info">
                    <div class="result-icon" style="background:#FEE2E2;color:#EF4444;">✕</div>
                    <div>
                        <div class="result-name">${result.name}</div>
                        <div class="result-sub">${result.error || '변환에 실패했습니다.'}</div>
                    </div>
                </div>
            `;
        }
        resultsList.appendChild(item);
    });

    if (successCount > 0) showToast(`${successCount}개 파일 변환 완료!`, 'success');
    if (failCount > 0)    showToast(`${failCount}개 파일 변환 실패`, 'error');
}
