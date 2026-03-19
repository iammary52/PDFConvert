/**
 * PDF 변환기 - Frontend JavaScript
 */

const ALLOWED_EXTENSIONS = ['doc', 'docx', 'hwp', 'hwpx', 'ppt', 'pptx'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
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
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileQueue = document.getElementById('fileQueue');
const fileList = document.getElementById('fileList');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const progressSection = document.getElementById('progressSection');
const progressList = document.getElementById('progressList');
const resultsSection = document.getElementById('resultsSection');
const resultsList = document.getElementById('resultsList');
const resetBtn = document.getElementById('resetBtn');
const toastContainer = createToastContainer();

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

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        default: 'ℹ'
    };

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
        // Prevent duplicates
        const isDupe = pendingFiles.some(f => f.name === file.name && f.size === file.size);
        if (!isDupe) {
            pendingFiles.push(file);
        } else {
            showToast(`"${file.name}" - 이미 목록에 있습니다.`, 'warning');
        }
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
        const ext = getExtension(file.name);
        const color = FILE_COLORS[ext] || '#6B7280';
        const label = FILE_LABELS[ext] || ext.toUpperCase();

        const item = document.createElement('div');
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

    // Attach remove events
    fileList.querySelectorAll('.file-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            pendingFiles.splice(idx, 1);
            if (pendingFiles.length === 0) {
                resetToUpload();
            } else {
                renderFileList();
            }
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
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
    }
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', (e) => {
    if (!e.target.closest('label') && !e.target.closest('input')) {
        fileInput.click();
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        addFiles(fileInput.files);
    }
});

clearBtn.addEventListener('click', resetToUpload);
resetBtn.addEventListener('click', resetToUpload);

// ===========================
// Conversion
// ===========================
convertBtn.addEventListener('click', startConversion);

async function startConversion() {
    if (pendingFiles.length === 0) return;

    // Switch to progress view
    fileQueue.style.display = 'none';
    dropZone.style.display = 'none';
    progressSection.style.display = 'block';
    progressList.innerHTML = '';

    const results = [];

    for (const file of pendingFiles) {
        const progressItem = createProgressItem(file.name);
        progressList.appendChild(progressItem);

        try {
            const pdfUrl = await convertFile(file, progressItem);
            results.push({ name: file.name, pdfUrl, success: true });
            setProgressDone(progressItem);
        } catch (err) {
            results.push({ name: file.name, error: err.message, success: false });
            setProgressError(progressItem, err.message);
        }
    }

    // Show results
    setTimeout(() => showResults(results), 600);
}

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
    const bar = item.querySelector('.progress-bar');
    const statusEl = item.querySelector('.progress-status');
    bar.className = `progress-bar ${status}`;
    statusEl.textContent = text;
}

function setProgressDone(item) {
    setProgressStatus(item, 'done', '완료 ✓');
    item.querySelector('.progress-status').style.color = '#10B981';
}

function setProgressError(item, msg) {
    setProgressStatus(item, 'error', '실패 ✕');
    item.querySelector('.progress-status').style.color = '#EF4444';
}

async function convertFile(file, progressItem) {
    setProgressStatus(progressItem, 'uploading', '업로드 중...');

    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await fetch('convert.php', {
        method: 'POST',
        body: formData
    });

    if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        let errMsg = '서버 오류가 발생했습니다.';
        try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error || errMsg;
        } catch(e) { /* ignore */ }
        throw new Error(errMsg);
    }

    const data = await uploadRes.json();

    if (data.error) {
        throw new Error(data.error);
    }

    // If server returns a job_id, poll for result
    if (data.job_id) {
        setProgressStatus(progressItem, 'converting', '변환 중...');
        return await pollJobStatus(data.job_id, progressItem);
    }

    // Direct download URL returned
    if (data.download_url) {
        return data.download_url;
    }

    throw new Error('예상치 못한 서버 응답입니다.');
}

async function pollJobStatus(jobId, progressItem, attempts = 0) {
    if (attempts > 40) {
        throw new Error('변환 시간이 초과되었습니다. 다시 시도해주세요.');
    }

    await sleep(3000);

    const res = await fetch(`convert.php?job_id=${encodeURIComponent(jobId)}`);
    const data = await res.json();

    if (data.error) {
        throw new Error(data.error);
    }

    if (data.status === 'finished' && data.download_url) {
        return data.download_url;
    }

    if (data.status === 'error') {
        throw new Error(data.message || '변환 중 오류가 발생했습니다.');
    }

    // Still processing
    setProgressStatus(progressItem, 'converting', '변환 중...');
    return pollJobStatus(jobId, progressItem, attempts + 1);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===========================
// Results
// ===========================
function showResults(results) {
    progressSection.style.display = 'none';
    resultsSection.style.display = 'block';
    resultsList.innerHTML = '';

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

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

    if (successCount > 0) {
        showToast(`${successCount}개 파일 변환 완료!`, 'success');
    }
    if (failCount > 0) {
        showToast(`${failCount}개 파일 변환 실패`, 'error');
    }
}
