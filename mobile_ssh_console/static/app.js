const SESSION_KEY = 'lingqu_mobile_ssh_session';
const app = document.querySelector('#app');
const template = document.querySelector('#workspaceTemplate');

let session = loadSession();
let cwd = session?.cwd || '~';
let parentPath = null;

const $ = (selector) => document.querySelector(selector);

function loadSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(nextSession) {
  session = nextSession;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
}

function clearSession() {
  session = null;
  window.localStorage.removeItem(SESSION_KEY);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok || payload.err_code !== 0) {
    throw new Error(payload.detail || payload.error || `request failed: ${response.status}`);
  }
  return payload.data;
}

function setError(message) {
  const box = $('#errorBox') || $('#loginError');
  if (!box) return;
  box.textContent = message || '';
  box.classList.toggle('hidden', !message);
}

function setBusy(button, busy, idleText) {
  button.disabled = busy;
  button.textContent = busy ? '执行中...' : idleText;
}

async function testSession(target, loginCwd) {
  return requestJson('/api/session/test', {
    method: 'POST',
    body: JSON.stringify({ target, cwd: loginCwd, command: 'pwd' }),
  });
}

function renderWorkspace() {
  app.className = 'app';
  app.innerHTML = '';
  app.appendChild(template.content.cloneNode(true));
  $('#sessionLabel').textContent = session.target;
  $('#cwdText').textContent = cwd;
  $('#cwdInput').value = cwd;
  $('#filePathInput').value = cwd;

  $('#switchHostBtn').addEventListener('click', () => {
    clearSession();
    window.location.reload();
  });
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
  document.querySelectorAll('.chips button').forEach((button) => {
    button.addEventListener('click', () => {
      $('#commandInput').value = button.dataset.command;
    });
  });
  $('#runBtn').addEventListener('click', runCommand);
  $('#openPathBtn').addEventListener('click', () => loadFiles($('#filePathInput').value));
  $('#parentBtn').addEventListener('click', () => parentPath && loadFiles(parentPath));
  $('#closePreviewBtn').addEventListener('click', () => $('#filePreview').classList.add('hidden'));
  loadFiles(cwd);
}

function switchTab(tab) {
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  $('#terminalPanel').classList.toggle('hidden', tab !== 'terminal');
  $('#filesPanel').classList.toggle('hidden', tab !== 'files');
}

async function runCommand() {
  const button = $('#runBtn');
  setBusy(button, true, '执行命令');
  setError('');
  try {
    const command = $('#commandInput').value;
    const nextCwd = $('#cwdInput').value || '~';
    const result = await requestJson('/api/terminal/run', {
      method: 'POST',
      body: JSON.stringify({ target: session.target, cwd: nextCwd, command }),
    });
    cwd = result.cwd;
    saveSession({ ...session, cwd });
    $('#cwdText').textContent = cwd;
    $('#filePathInput').value = cwd;
    prependTerminalResult(result);
  } catch (error) {
    setError(String(error));
  } finally {
    setBusy(button, false, '执行命令');
  }
}

function prependTerminalResult(result) {
  const history = $('#terminalHistory');
  const empty = history.querySelector('.empty');
  if (empty) empty.remove();
  const card = document.createElement('article');
  card.className = `terminal-card ${result.exit_code === 0 ? 'ok' : 'fail'}`;
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n') || '(no output)';
  card.innerHTML = `<header><b>$ ${escapeHtml(result.command)}</b><span>${result.exit_code === 0 ? 'OK' : `Exit ${result.exit_code}`}</span></header><pre>${escapeHtml(output)}</pre>`;
  history.prepend(card);
}

async function loadFiles(path) {
  setError('');
  try {
    const data = await requestJson(`/api/files?target=${encodeURIComponent(session.target)}&path=${encodeURIComponent(path || '~')}`);
    cwd = data.path;
    parentPath = data.parent;
    saveSession({ ...session, cwd });
    $('#cwdText').textContent = cwd;
    $('#cwdInput').value = cwd;
    $('#filePathInput').value = cwd;
    $('#parentBtn').classList.toggle('hidden', !parentPath);
    renderFiles(data.items);
  } catch (error) {
    setError(String(error));
  }
}

function renderFiles(items) {
  const list = $('#fileList');
  list.innerHTML = '';
  items.forEach((item) => {
    const button = document.createElement('button');
    button.className = item.type;
    button.innerHTML = `<b>${item.type === 'dir' ? '▣' : '▤'}</b><span>${escapeHtml(item.name)}</span><small>${item.type === 'dir' ? '目录' : `${Math.ceil(item.size / 1024)} KB`} · ${escapeHtml(item.modified)}</small>`;
    button.addEventListener('click', () => item.type === 'dir' ? loadFiles(item.path) : readFile(item.path));
    list.appendChild(button);
  });
}

async function readFile(path) {
  setError('');
  try {
    const data = await requestJson(`/api/files/read?target=${encodeURIComponent(session.target)}&path=${encodeURIComponent(path)}`);
    $('#previewPath').textContent = data.path;
    $('#previewContent').textContent = data.content;
    $('#filePreview').classList.remove('hidden');
  } catch (error) {
    setError(String(error));
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function boot() {
  const targetInput = $('#sshTarget');
  const cwdInput = $('#loginCwd');
  const loginButton = $('#loginBtn');
  if (session?.target) {
    renderWorkspace();
    return;
  }
  targetInput.value = '';
  cwdInput.value = '~';
  loginButton.addEventListener('click', async () => {
    setError('');
    const target = targetInput.value.trim();
    const loginCwd = cwdInput.value.trim() || '~';
    if (!target) {
      setError('请输入 SSH 目标');
      return;
    }
    setBusy(loginButton, true, '登录 SSH');
    try {
      const result = await testSession(target, loginCwd);
      if (result.exit_code !== 0) {
        throw new Error(result.stderr || 'SSH 登录失败');
      }
      saveSession({ target, cwd: loginCwd });
      cwd = loginCwd;
      renderWorkspace();
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(loginButton, false, '登录 SSH');
    }
  });
}

boot();
