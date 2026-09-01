/**
 * FiLE LoCKeR — Upload Page Client Script
 * Features: drag-drop, file validation, real XHR progress, success state
 */

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let selectedFiles = [];

const ALLOWED_EXTENSIONS = new Set(['.pdf','.txt','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.jpg','.jpeg','.png','.zip']);
const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const dropZone      = document.getElementById('dropZone');
const fileInput     = document.getElementById('fileInput');
const fileList      = document.getElementById('fileList');
const fileError     = document.getElementById('fileError');
const uploadBtn     = document.getElementById('uploadBtn');
const uploadBtnText = document.getElementById('uploadBtnText');
const uploadError   = document.getElementById('uploadError');
const progressWrap  = document.getElementById('progressWrap');
const progressFill  = document.getElementById('progressFill');
const progressPct   = document.getElementById('progressPct');
const progressStatus= document.getElementById('progressStatus');
const uploadState   = document.getElementById('uploadState');
const successState  = document.getElementById('successState');
const successFiles  = document.getElementById('successFiles');
const dzIcon        = document.getElementById('dzIcon');

// ─── Drag & Drop ──────────────────────────────────────────────────────────────
dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(Array.from(e.dataTransfer.files));
});

fileInput.addEventListener('change', () => {
  handleFiles(Array.from(fileInput.files));
  fileInput.value = '';  // Reset so same file can be re-selected
});

// ─── File Handling ────────────────────────────────────────────────────────────
function handleFiles(incoming) {
  fileError.style.display = 'none';
  const errors = [];

  for (const file of incoming) {
    const ext = getExt(file.name);

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      errors.push(`"${file.name}" — unsupported file type (${ext || 'no extension'}).`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`"${file.name}" — exceeds ${MAX_FILE_SIZE_MB} MB limit.`);
      continue;
    }
    if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      continue;  // Skip duplicates
    }

    selectedFiles.push(file);
  }

  if (errors.length > 0) {
    fileError.textContent = errors.join(' ');
    fileError.style.display = 'block';
  }

  renderFileList();
  updateUploadBtn();
}

function getExt(filename) {
  const i = filename.lastIndexOf('.');
  return i !== -1 ? filename.slice(i).toLowerCase() : '';
}

function fileIcon(ext) {
  const icons = {
    '.pdf':  '📕', '.txt':  '📄',
    '.doc':  '📝', '.docx': '📝',
    '.xls':  '📊', '.xlsx': '📊',
    '.ppt':  '📋', '.pptx': '📋',
    '.jpg':  '🖼️', '.jpeg': '🖼️', '.png': '🖼️',
    '.zip':  '📦',
  };
  return icons[ext] || '📁';
}

function formatSize(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1_048_576)   return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1_048_576).toFixed(1) + ' MB';
}

function renderFileList() {
  fileList.innerHTML = '';
  dzIcon.textContent = selectedFiles.length > 0 ? '✅' : '📁';

  selectedFiles.forEach((file, idx) => {
    const ext = getExt(file.name);
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span class="file-item-icon">${fileIcon(ext)}</span>
      <div class="file-item-info">
        <div class="file-item-name" title="${escHtml(file.name)}">${escHtml(file.name)}</div>
        <div class="file-item-size">${formatSize(file.size)}</div>
      </div>
      <button class="file-item-remove" onclick="removeFile(${idx})" title="Remove file" aria-label="Remove ${escHtml(file.name)}">✕</button>
    `;
    fileList.appendChild(item);
  });
}

function removeFile(idx) {
  selectedFiles.splice(idx, 1);
  renderFileList();
  updateUploadBtn();
  fileError.style.display = 'none';
}

// ─── Password Strength ────────────────────────────────────────────────────────
const passwordInput = document.getElementById('password');
const strengthBar   = document.getElementById('strengthBar');
const strengthLabel = document.getElementById('strengthLabel');
const confirmInput  = document.getElementById('confirmPassword');
const confirmHint   = document.getElementById('confirmHint');

passwordInput.addEventListener('input', () => {
  updateStrength(passwordInput.value);
  checkConfirm();
  updateUploadBtn();
});

confirmInput.addEventListener('input', () => {
  checkConfirm();
  updateUploadBtn();
});

function updateStrength(pw) {
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { label: '',           color: '',                     pct: 0   },
    { label: 'Too short',  color: '#ef4444',              pct: 15  },
    { label: 'Weak',       color: '#f97316',              pct: 30  },
    { label: 'Fair',       color: '#eab308',              pct: 55  },
    { label: 'Good',       color: '#22c55e',              pct: 78  },
    { label: 'Strong',     color: '#10b981',              pct: 100 },
  ];

  const level = pw.length === 0 ? levels[0] : (score <= 1 ? levels[1] : levels[score]);

  strengthBar.style.width      = level.pct + '%';
  strengthBar.style.background = level.color;
  strengthLabel.textContent    = level.label;
  strengthLabel.style.color    = level.color;
}

function checkConfirm() {
  const pw = passwordInput.value;
  const cf = confirmInput.value;
  if (!cf) { confirmHint.textContent = ''; return; }
  if (pw === cf) {
    confirmHint.textContent = '✓ Passwords match';
    confirmHint.style.color = '#34d399';
  } else {
    confirmHint.textContent = '✗ Passwords do not match';
    confirmHint.style.color = '#f87171';
  }
}

// ─── Upload Button State ───────────────────────────────────────────────────────
function updateUploadBtn() {
  const hasFiles    = selectedFiles.length > 0;
  const hasPassword = passwordInput.value.length >= 6;
  const pwMatch     = passwordInput.value === confirmInput.value;
  uploadBtn.disabled = !(hasFiles && hasPassword && pwMatch);
}

// ─── Password Toggle ──────────────────────────────────────────────────────────
function togglePwd(id, btn) {
  const el = document.getElementById(id);
  const isHidden = el.type === 'password';
  el.type = isHidden ? 'text' : 'password';
  btn.querySelector('.eye-icon').textContent = isHidden ? '🙈' : '👁';
}

// ─── Upload via XHR (Real Progress) ──────────────────────────────────────────
function startUpload() {
  uploadError.style.display = 'none';

  // Client-side validation
  if (selectedFiles.length === 0) {
    uploadError.textContent = 'Please select at least one file.';
    uploadError.style.display = 'block';
    return;
  }
  const pw = passwordInput.value;
  if (!pw || pw.length < 6) {
    uploadError.textContent = 'Password must be at least 6 characters.';
    uploadError.style.display = 'block';
    return;
  }
  if (pw !== confirmInput.value) {
    uploadError.textContent = 'Passwords do not match.';
    uploadError.style.display = 'block';
    return;
  }

  // Build FormData
  const formData = new FormData();
  selectedFiles.forEach(file => formData.append('files', file));
  formData.append('password',     pw);
  formData.append('expiry',       document.getElementById('expiry').value);
  formData.append('maxDownloads', document.getElementById('maxDownloads').value);

  // Disable controls
  setUploading(true);

  // XHR with real upload progress
  const xhr = new XMLHttpRequest();

  // ── Real progress events ──
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      setProgress(pct, pct < 100 ? 'Uploading…' : 'Processing…');
    }
  });

  xhr.upload.addEventListener('loadstart', () => {
    progressWrap.style.display = 'block';
    setProgress(0, 'Starting upload…');
  });

  xhr.addEventListener('load', () => {
    try {
      const data = JSON.parse(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300 && data.success) {
        setProgress(100, 'Complete!');
        setTimeout(() => showSuccess(data.files), 400);
      } else {
        setUploading(false);
        progressWrap.style.display = 'none';
        uploadError.textContent = data.error || 'Upload failed. Please try again.';
        uploadError.style.display = 'block';
      }
    } catch (_) {
      setUploading(false);
      progressWrap.style.display = 'none';
      uploadError.textContent = 'Unexpected server response. Please try again.';
      uploadError.style.display = 'block';
    }
  });

  xhr.addEventListener('error', () => {
    setUploading(false);
    progressWrap.style.display = 'none';
    uploadError.textContent = 'Network error. Please check your connection and try again.';
    uploadError.style.display = 'block';
  });

  xhr.addEventListener('abort', () => {
    setUploading(false);
    progressWrap.style.display = 'none';
    uploadError.textContent = 'Upload cancelled.';
    uploadError.style.display = 'block';
  });

  xhr.open('POST', '/upload');
  xhr.send(formData);
}

function setProgress(pct, status) {
  progressFill.style.width = pct + '%';
  progressFill.setAttribute('aria-valuenow', pct);
  progressPct.textContent  = pct + '%';
  progressStatus.textContent = status;
}

function setUploading(active) {
  uploadBtn.disabled = active;
  uploadBtnText.textContent = active ? '⏳ Uploading…' : '🔒 Upload Files Securely';
  dropZone.style.pointerEvents = active ? 'none' : '';
  fileInput.disabled = active;
}

// ─── Success State ────────────────────────────────────────────────────────────
function showSuccess(files) {
  uploadState.style.display = 'none';
  successState.style.display = 'block';

  successFiles.innerHTML = files.map(file => `
    <div class="success-file-card">
      <div class="success-file-name">${escHtml(file.name)}</div>
      <div class="success-file-size">${formatSize(file.size)}</div>

      <div class="success-links">
        <div>
          <div class="success-link-label">🔗 Public Share Link</div>
          <div class="copy-row" style="margin-bottom:0.25rem;">
            <input type="text" class="field-input" value="${escHtml(location.origin + file.shareLink)}" readonly
              aria-label="Public share link for ${escHtml(file.name)}" />
            <button class="btn btn-secondary copy-btn" onclick="copyVal(this)" title="Copy share link">📋 Copy</button>
          </div>
          <p class="field-hint">Share this link with anyone who needs the file.</p>
        </div>

        <div style="margin-top:0.75rem;">
          <div class="success-link-label">🔑 Private Management Link</div>
          <div class="copy-row" style="margin-bottom:0.25rem;">
            <input type="text" class="field-input" value="${escHtml(location.origin + file.manageLink)}" readonly
              aria-label="Private management link for ${escHtml(file.name)}" />
            <button class="btn btn-secondary copy-btn" onclick="copyVal(this)" title="Copy management link">📋 Copy</button>
          </div>
          <p class="field-hint field-hint-warning">⚠️ Keep this private — it lets you view stats and delete the file.</p>
        </div>
      </div>
    </div>
  `).join('');
}

function copyVal(btn) {
  const input = btn.parentElement.querySelector('input');
  navigator.clipboard.writeText(input.value)
    .then(() => {
      const orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      btn.classList.add('btn-success');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('btn-success'); }, 2500);
    })
    .catch(() => { input.select(); try { document.execCommand('copy'); } catch(_) {} });
}

function resetForm() {
  selectedFiles = [];
  renderFileList();
  passwordInput.value    = '';
  confirmInput.value     = '';
  strengthBar.style.width = '0%';
  strengthLabel.textContent = '';
  confirmHint.textContent = '';
  dzIcon.textContent = '📁';
  fileError.style.display  = 'none';
  uploadError.style.display = 'none';
  progressWrap.style.display = 'none';
  setProgress(0, '');
  setUploading(false);
  updateUploadBtn();

  successState.style.display = 'none';
  uploadState.style.display  = 'block';
  successFiles.innerHTML = '';
}

// ─── HTML Escape ──────────────────────────────────────────────────────────────
function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
