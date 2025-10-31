// WhatsApp Blaze - Account Renderer (Core & Shared Functions)

// ====== UI State & Performance Optimizations ======
const uiState = {
    activeMain: 'extractor',
    activeSub: {
        extractor: 'extract-contact',
        automation: 'send-to-contact',
    }
};

// ====== MAIN DATA STRUCTURE ======
let currentData = {
    contacts: [],
    chatContacts: [],
    groups: [],
    groupMembers: [],
    sendingContacts: [],
    sendingGroups: [],
    
    selectedGroups: new Set(),
    selectedSendingContacts: new Set(),
    selectedSendingGroups: new Set(),
    
    // Auto Reply Data Structure
    replySettings: {
        enabled: false,
        delay: 5,
        workHours: {
            start: '08:00',
            end: '17:00'
        },
        replyOnlyWorkHours: false,
        replyToGroups: false,
        replyToUnknown: true
    },
    
    replyRules: [],
    
    messageLog: [],
    
    autoReplyStats: {
        totalProcessed: 0,
        successCount: 0,
        failCount: 0,
        lastCheck: null
    },
    
    automationState: {
        isRunning: false,
        isPaused: false,
        isStopped: false,
        currentIndex: 0,
        totalProcessed: 0,
        successCount: 0,
        failCount: 0
    },
    
    automationSettings: {
        minDelay: 2,
        maxDelay: 5,
        sleepAfter: 10,
        sleepMinutes: 2,
        message: "",
        attachment: null,
        sendToContacts: true,
        sendToGroups: false,
        includeCaption: true
    },

    // ====== PERBAIKAN: Tracking untuk mencegah duplikasi balasan ======
    repliedMessageTracker: new Set(),
    lastProcessedTimestamp: 0
};

let whatsappWebview = null;
let isWebViewInitialized = false;
let webViewReadyPromise = null;
let isInitializing = false;

// Message Sending Variables
let isSending = false;
let isPaused = false;
let isStopped = false;
let currentSendingIndex = 0;

// Auto Reply Variables
let isCheckingMessages = false;
let autoReplyInterval = null;
let isAutoReplyRunning = false;

// Search Debouncing
let searchTimeouts = {};

// ============================================================================
// INITIALIZATION & CORE MANAGEMENT
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 WhatsApp Blaze initialized');
    initializeApp();
});

function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get('accountId');
    document.getElementById('accountNameDisplay').textContent = accountId || 'Unknown Account';

    console.log('🔄 Initializing WhatsApp Blaze...');

    initializeMainTabs();
    initializeSubTabs();
    initializeGroupSubTabs();
    initializeSearchHandlers();
    initializeMessageEvents();
    initializeWebView();
    
    // Initialize Auto Reply Data
    initializeAutoReplyData();
    
    addStatusLog('🚀 WhatsApp Blaze sedang memulai...');
    addStatusLog('📱 Menunggu WhatsApp Web loading...');

    console.log('✅ App initialized successfully');
}

function initializeAutoReplyData() {
    // Load saved data from localStorage or initialize defaults
    const savedRules = localStorage.getItem('whatsappBlaze_replyRules');
    const savedSettings = localStorage.getItem('whatsappBlaze_replySettings');
    const savedLog = localStorage.getItem('whatsappBlaze_messageLog');
    
    if (savedRules) {
        currentData.replyRules = JSON.parse(savedRules);
    }
    
    if (savedSettings) {
        currentData.replySettings = { ...currentData.replySettings, ...JSON.parse(savedSettings) };
    }
    
    if (savedLog) {
        currentData.messageLog = JSON.parse(savedLog);
    }
    
    // Update UI controls based on loaded settings
    updateAutoReplyControls();
    updateAutoReplyStatusDisplay();
    
    console.log('✅ Auto reply data initialized');
}

function saveAutoReplyData() {
    try {
        localStorage.setItem('whatsappBlaze_replyRules', JSON.stringify(currentData.replyRules));
        localStorage.setItem('whatsappBlaze_replySettings', JSON.stringify(currentData.replySettings));
        localStorage.setItem('whatsappBlaze_messageLog', JSON.stringify(currentData.messageLog));
    } catch (error) {
        console.error('Error saving auto reply data:', error);
    }
}

// ============================================================================
// SEARCH HANDLERS - FIXED VERSION
// ============================================================================

function initializeSearchHandlers() {
    const searchInputs = {
        'contactsSearch': 'contactsTableBody',
        'chatContactsSearch': 'chatContactsTableBody',
        'groupsSearch': 'groupsTableBody',
        'groupMembersSearch': 'groupMembersTableBody',
        'sendingContactsSearch': 'sendingContactsTableBody',
        'sendingGroupsSearch': 'sendingGroupsTableBody'
    };

    Object.entries(searchInputs).forEach(([searchId, tableBodyId]) => {
        const input = document.getElementById(searchId);
        if (input) {
            // Simple approach - langsung pasang event listener
            input.addEventListener('input', function(e) {
                const searchTerm = e.target.value;
                // Clear previous timeout
                if (searchTimeouts[tableBodyId]) {
                    clearTimeout(searchTimeouts[tableBodyId]);
                }
                // Set new timeout
                searchTimeouts[tableBodyId] = setTimeout(() => {
                    handleSearch(tableBodyId, searchTerm);
                }, 300);
            });
            
            // Tambahkan event untuk escape key
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    this.value = '';
                    handleSearch(tableBodyId, '');
                }
            });
        }
    });
}

function handleSearch(tableBodyId, searchTerm) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;

    const rows = tbody.getElementsByTagName('tr');
    const searchLower = searchTerm.toLowerCase().trim();

    let foundAny = false;

    for (let row of rows) {
        // Skip empty rows
        if (row.cells.length <= 1) {
            // Tampilkan row kosong jika search kosong
            row.style.display = searchLower === '' ? '' : 'none';
            continue;
        }
        
        let rowText = '';
        for (let cell of row.cells) {
            rowText += cell.textContent.toLowerCase() + ' ';
        }

        const shouldShow = searchLower === '' || rowText.includes(searchLower);
        
        if (shouldShow) {
            row.style.display = '';
            foundAny = true;
        } else {
            row.style.display = 'none';
        }
    }

    // Handle no results
    showNoResultsMessage(tbody, foundAny, searchTerm);
}

function showNoResultsMessage(tbody, foundAny, searchTerm) {
    // Hapus pesan no results sebelumnya
    const existingNoResults = tbody.querySelector('.no-search-results');
    if (existingNoResults) {
        existingNoResults.remove();
    }

    // Jika tidak ada hasil dan search tidak kosong, tampilkan pesan
    if (!foundAny && searchTerm.trim() !== '') {
        const noResultsRow = document.createElement('tr');
        noResultsRow.className = 'no-search-results';
        noResultsRow.innerHTML = `
            <td colspan="10" class="px-4 py-8 text-center text-sm text-slate-500">
                <i class="fas fa-search text-2xl text-slate-300 mb-2 block"></i>
                Tidak ditemukan hasil untuk "<span class="font-medium">${searchTerm}</span>"
                <br>
                <button onclick="clearSearch('${tbody.id}')" 
                        class="mt-2 text-xs text-blue-600 hover:text-blue-800 underline">
                    Reset pencarian
                </button>
            </td>
        `;
        tbody.appendChild(noResultsRow);
    }
}

function clearSearch(tableBodyId) {
    // Cari input search yang sesuai
    const searchInputs = {
        'contactsTableBody': 'contactsSearch',
        'chatContactsTableBody': 'chatContactsSearch',
        'groupsTableBody': 'groupsSearch',
        'groupMembersTableBody': 'groupMembersSearch',
        'sendingContactsTableBody': 'sendingContactsSearch',
        'sendingGroupsTableBody': 'sendingGroupsSearch'
    };

    const searchId = searchInputs[tableBodyId];
    if (searchId) {
        const input = document.getElementById(searchId);
        if (input) {
            input.value = '';
        }
    }

    // Reset tampilan tabel
    handleSearch(tableBodyId, '');
}

// ============================================================================
// MESSAGE EVENTS & SETTINGS
// ============================================================================

function initializeMessageEvents() {
    const fileAttachment = document.getElementById('fileAttachment');
    if (fileAttachment) {
        fileAttachment.addEventListener('change', handleFileAttachment);
    }
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            currentData.automationSettings.message = this.value;
            document.getElementById('charCount').textContent = `${this.value.length} karakter`;
        });
    }
    
    const minDelay = document.getElementById('minDelay');
    const maxDelay = document.getElementById('maxDelay');
    const sleepAfter = document.getElementById('sleepAfter');
    const sleepMinutes = document.getElementById('sleepMinutes');
    
    if (minDelay) minDelay.addEventListener('change', updateAutomationSettings);
    if (maxDelay) maxDelay.addEventListener('change', updateAutomationSettings);
    if (sleepAfter) sleepAfter.addEventListener('change', updateAutomationSettings);
    if (sleepMinutes) sleepMinutes.addEventListener('change', updateAutomationSettings);
    
    // Auto Reply Settings Events
    const checkInterval = document.getElementById('checkInterval');
    const replyToGroups = document.getElementById('replyToGroups');
    const replyToUnknown = document.getElementById('replyToUnknown');
    
    if (checkInterval) checkInterval.addEventListener('change', updateReplySettings);
    if (replyToGroups) replyToGroups.addEventListener('change', updateReplySettings);
    if (replyToUnknown) replyToUnknown.addEventListener('change', updateReplySettings);
}

function updateAutomationSettings() {
    currentData.automationSettings.minDelay = parseInt(document.getElementById('minDelay').value) || 2;
    currentData.automationSettings.maxDelay = parseInt(document.getElementById('maxDelay').value) || 5;
    currentData.automationSettings.sleepAfter = parseInt(document.getElementById('sleepAfter').value) || 10;
    currentData.automationSettings.sleepMinutes = parseInt(document.getElementById('sleepMinutes').value) || 2;
}

function updateReplySettings() {
    const delay = parseInt(document.getElementById('checkInterval').value) || 5;
    const replyToGroups = document.getElementById('replyToGroups').checked;
    const replyToUnknown = document.getElementById('replyToUnknown').checked;
    
    currentData.replySettings.delay = delay;
    currentData.replySettings.replyToGroups = replyToGroups;
    currentData.replySettings.replyToUnknown = replyToUnknown;
    
    // Jika auto reply sedang berjalan, restart dengan interval baru
    if (isAutoReplyRunning) {
        restartAutoReply();
    }
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

function initializeMainTabs() {
    const mainTabButtons = document.querySelectorAll('.main-tab-button');

    mainTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            switchMainTab(targetTab);
        });
    });

    switchMainTab('extractor');
}

function switchMainTab(targetMain) {
    if (uiState.activeMain === targetMain) return;

    console.log('Switching to main tab:', targetMain);

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.querySelectorAll('.sub-tabs').forEach(subTab => {
        subTab.classList.add('hidden');
    });

    const targetContent = document.getElementById(`${targetMain}Content`);
    const targetSubTabs = document.getElementById(`${targetMain}SubTabs`);
    
    if (targetContent) targetContent.classList.remove('hidden');
    if (targetSubTabs) targetSubTabs.classList.remove('hidden');

    uiState.activeMain = targetMain;
    updateMainTabButtons(targetMain);
    resetToFirstSubTab(targetMain);
    
    // Jika pindah ke tab reply, update controls
    if (targetMain === 'reply') {
        updateAutoReplyControls();
        updateAutoReplyStatusDisplay();
    }
}

function updateMainTabButtons(activeTab) {
    document.querySelectorAll('.main-tab-button').forEach(btn => {
        const tabName = btn.getAttribute('data-tab');
        const isActive = tabName === activeTab;
        
        btn.classList.remove('active', 'text-blue-600', 'text-purple-600', 'text-green-600', 'border-blue-500', 'border-purple-500', 'border-green-500');
        
        if (isActive) {
            btn.classList.add('active');
            if (activeTab === 'extractor') {
                btn.classList.add('text-blue-600', 'border-blue-500');
            } else if (activeTab === 'automation') {
                btn.classList.add('text-purple-600', 'border-purple-500');
            } else if (activeTab === 'reply') {
                btn.classList.add('text-green-600', 'border-green-500');
            }
        } else {
            btn.classList.add('text-slate-600', 'border-transparent');
        }
    });
}

function initializeSubTabs() {
    const extractorButtons = document.querySelectorAll('#extractorSubTabs .sub-tab-button');
    extractorButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetSubTab = this.getAttribute('data-subtab');
            switchSubTab('extractor', targetSubTab);
        });
    });

    const automationButtons = document.querySelectorAll('#automationSubTabs .sub-tab-button');
    automationButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetSubTab = this.getAttribute('data-subtab');
            switchSubTab('automation', targetSubTab);
        });
    });
}

function switchSubTab(mainTab, targetSubTab) {
    console.log(`Switching ${mainTab} sub tab to:`, targetSubTab);

    const subTabContents = document.querySelectorAll(`#${mainTab}Content .sub-tab-content`);
    subTabContents.forEach(content => {
        content.classList.add('hidden');
    });

    const targetContent = document.getElementById(`${targetSubTab}-content`);
    if (targetContent) {
        targetContent.classList.remove('hidden');
    }

    updateSubTabButtons(mainTab, targetSubTab);
    uiState.activeSub[mainTab] = targetSubTab;
}

function updateSubTabButtons(mainTab, activeSubTab) {
    const subTabButtons = document.querySelectorAll(`#${mainTab}SubTabs .sub-tab-button`);
    
    subTabButtons.forEach(btn => {
        const subTabName = btn.getAttribute('data-subtab');
        const isActive = subTabName === activeSubTab;
        
        btn.classList.remove('active', 'text-blue-600', 'text-purple-600', 'border-blue-500', 'border-purple-500');
        
        if (isActive) {
            btn.classList.add('active');
            if (mainTab === 'extractor') {
                btn.classList.add('text-blue-600', 'border-blue-500');
            } else {
                btn.classList.add('text-purple-600', 'border-purple-500');
            }
        } else {
            btn.classList.add('text-slate-600', 'border-transparent');
        }
    });
}

function resetToFirstSubTab(mainTab) {
    const firstSubTab = document.querySelector(`#${mainTab}SubTabs .sub-tab-button`);
    if (firstSubTab) {
        const targetSubTab = firstSubTab.getAttribute('data-subtab');
        switchSubTab(mainTab, targetSubTab);
    }
}

function initializeGroupSubTabs() {
    const groupSubTabButtons = document.querySelectorAll('.group-sub-tab-button');

    groupSubTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetGroupSubTab = this.getAttribute('data-group-subtab');
            
            console.log('Group sub tab clicked:', targetGroupSubTab);
            
            groupSubTabButtons.forEach(btn => {
                const isActive = btn === this;
                btn.classList.toggle('active', isActive);
                btn.classList.toggle('text-blue-600', isActive);
                btn.classList.toggle('border-blue-500', isActive);
                btn.classList.toggle('text-slate-600', !isActive);
                btn.classList.toggle('border-transparent', !isActive);
            });

            const groupSubTabContents = document.querySelectorAll('.group-sub-tab-content');
            groupSubTabContents.forEach(content => {
                content.classList.add('hidden');
            });
            
            const targetContent = document.getElementById(`${targetGroupSubTab}-content`);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
        });
    });

    const firstGroupTab = document.querySelector('.group-sub-tab-button');
    if (firstGroupTab) {
        firstGroupTab.click();
    }
}

// ============================================================================
// WEBVIEW MANAGEMENT
// ============================================================================

// Export functions ke window object
window.clearSearch = clearSearch;
window.handleSearch = handleSearch;

function initializeWebView() {
    if (isInitializing) return;
    isInitializing = true;

    webViewReadyPromise = new Promise((resolve, reject) => {
        const urlParams = new URLSearchParams(window.location.search);
        const accountId = urlParams.get('accountId') || 'default';
        
        whatsappWebview = document.getElementById('whatsappWebview');
        if (!whatsappWebview) {
            reject(new Error('WebView element not found'));
            return;
        }

        whatsappWebview.partition = `persist:whatsapp-${accountId}`;
        
        console.log('=== 🎯 WEBVIEW PERSISTENCE SETUP ===');
        console.log('🔧 Account ID:', accountId);
        console.log('🎯 Partition:', whatsappWebview.partition);
        
        whatsappWebview.src = "https://web.whatsapp.com";
        addStatusLog(`🔧 Setup profile terpisah untuk: ${accountId}`);

        whatsappWebview.addEventListener('dom-ready', async () => {
            document.getElementById('webviewStatus').textContent = 'DOM Ready';
            isWebViewInitialized = true;
            
            console.log('✅ WebView DOM Ready');
            
            injectWebViewCSS();
            await performPersistenceCheck(accountId);
            // injectWAPIScript().then(() => {
            //     addStatusLog('✅ WhatsApp Web siap digunakan!');
            //     resolve(true);
            // }).catch(() => {
            //     addStatusLog('⚠️ WAPI tidak tersedia, fitur terbatas');
            //     resolve(true);
            // });
        });

        whatsappWebview.addEventListener('did-start-loading', () => {
            document.getElementById('webviewStatus').textContent = 'Loading...';
            addStatusLog('🔄 Memuat WhatsApp Web...');
        });

        whatsappWebview.addEventListener('did-finish-load', () => {
            document.getElementById('webviewStatus').textContent = 'Loaded';
            isWebViewInitialized = true;
            addStatusLog('✅ WhatsApp Web loaded');
        });

        whatsappWebview.addEventListener('did-fail-load', (event) => {
            addStatusLog('❌ Gagal load WhatsApp Web');
            reject(new Error(event.errorDescription));
        });
    });
}

async function performPersistenceCheck(accountId) {
    try {
        console.log('🧪 MEMULAI PERSISTENCE CHECK...');
        addStatusLog('🧪 Mengecek isolasi profile...');
        
        await delay(2000);
        
        const checkResults = {
            accountId: accountId,
            partition: whatsappWebview.partition,
            timestamp: new Date().toISOString()
        };

        const storageTest = await executeInWebView(`
            (function() {
                try {
                    const testKey = 'persistence_test_account';
                    const testValue = '${accountId}_' + Date.now();
                    
                    localStorage.setItem(testKey, testValue);
                    const retrievedValue = localStorage.getItem(testKey);
                    
                    const allKeys = Object.keys(localStorage);
                    const ourKeys = allKeys.filter(key => key.includes('persistence_test'));
                    
                    return {
                        success: retrievedValue === testValue,
                        testKey: testKey,
                        setValue: testValue,
                        retrievedValue: retrievedValue,
                        totalKeys: allKeys.length,
                        ourKeys: ourKeys
                    };
                } catch (error) {
                    return { error: error.message };
                }
            })();
        `);
        
        checkResults.storageTest = storageTest;
        
        if (storageTest.success) {
            addStatusLog('✅ Local Storage: TERISOLASI (Profile berbeda)');
        } else {
            addStatusLog('❌ Local Storage: GAGAL isolasi');
        }

        return checkResults;
        
    } catch (error) {
        console.error('❌ Persistence check error:', error);
        addStatusLog('❌ Error saat cek persistence: ' + error.message);
        return null;
    }
}

async function ensureWebViewReady() {
    if (!whatsappWebview) {
        throw new Error('WebView element not found');
    }
    
    if (!isWebViewInitialized && webViewReadyPromise) {
        await webViewReadyPromise;
    }
    
    return true;
}

async function injectWAPIScript() {
    if (!whatsappWebview) return false;
    
    try {
        const response = await fetch('./wa2.js');
        if (response.ok) {
            const wapiScript = await response.text();
            const result = await whatsappWebview.executeJavaScript(`
                (function() {
                    try {
                        ${wapiScript}
                        return { success: true };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                })();
            `);
            return result && result.success;
        }
    } catch (error) {
        console.log('Cannot load WAPI from file');
    }
    
    return false;
}

function injectWebViewCSS() {
    if (!whatsappWebview) return;
    
    const css = `
        .warning, .browser-update, [data-testid="update-browser"] {
            display: none !important;
        }
    `;
    
    try {
        whatsappWebview.executeJavaScript(`
            (function() {
                try {
                    var style = document.createElement('style');
                    style.textContent = \`${css}\`;
                    document.head.appendChild(style);
                    return true;
                } catch (error) {
                    return false;
                }
            })();
        `);
    } catch (error) {
        console.error('Error injecting CSS:', error);
    }
}

// ============================================================================
// AUTO REPLY CORE FUNCTIONS - DIPERBAIKI DENGAN START/STOP
// ============================================================================

async function startAutoReply() {
    if (isAutoReplyRunning) {
        showNotification('Auto reply sudah berjalan!', 'warning');
        return;
    }

    // Validasi settings
    const delay = parseInt(document.getElementById('checkInterval').value) || 5;
    if (delay < 1 || delay > 60) {
        showNotification('Interval harus antara 1-60 detik!', 'error');
        return;
    }

    // Validasi rules
    const activeRules = currentData.replyRules.filter(rule => rule.active);
    if (activeRules.length === 0) {
        showNotification('Tidak ada rules yang aktif! Aktifkan minimal 1 rule terlebih dahulu.', 'error');
        return;
    }

    // Update status
    isAutoReplyRunning = true;
    updateAutoReplyControls();
    
    // Update settings
    currentData.replySettings.enabled = true;
    currentData.replySettings.delay = delay;
    
    // Save settings
    saveAutoReplyData();
    
    // Update UI status
    updateAutoReplyStatusDisplay();
    
    addStatusLog('🚀 Auto reply dimulai...');
    showNotification(`Auto reply dimulai dengan interval ${delay} detik`, 'success');

    // Jalankan pengecekan pertama kali
    await checkUnreadMessages();

    // Set interval untuk pengecekan berkelanjutan
    autoReplyInterval = setInterval(async () => {
        if (!isAutoReplyRunning) return;
        
        try {
            await checkUnreadMessages();
        } catch (error) {
            console.error('Auto reply interval error:', error);
            addStatusLog(`❌ Error dalam auto reply: ${error.message}`);
        }
    }, delay * 1000);
}

function stopAutoReply() {
    if (!isAutoReplyRunning) {
        showNotification('Auto reply belum berjalan!', 'warning');
        return;
    }

    // Hentikan interval
    if (autoReplyInterval) {
        clearInterval(autoReplyInterval);
        autoReplyInterval = null;
    }

    // Update status
    isAutoReplyRunning = false;
    updateAutoReplyControls();
    
    // Update settings
    currentData.replySettings.enabled = false;
    
    // Save settings
    saveAutoReplyData();
    
    // Update UI status
    updateAutoReplyStatusDisplay();
    
    addStatusLog('⏹️ Auto reply dihentikan');
    showNotification('Auto reply dihentikan', 'info');
}

function restartAutoReply() {
    if (isAutoReplyRunning) {
        stopAutoReply();
        setTimeout(startAutoReply, 1000);
    }
}

function updateAutoReplyControls() {
    const startBtn = document.getElementById('startAutoReplyBtn');
    const stopBtn = document.getElementById('stopAutoReplyBtn');
    
    if (isAutoReplyRunning) {
        // Mode berjalan - tampilkan tombol stop
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'inline-flex';
    } else {
        // Mode berhenti - tampilkan tombol start
        if (startBtn) startBtn.style.display = 'inline-flex';
        if (stopBtn) stopBtn.style.display = 'none';
    }
}

function updateAutoReplyStatusDisplay() {
    const statusElement = document.getElementById('autoReplyStatus');
    const lastCheckElement = document.getElementById('autoReplyLastCheck');
    
    if (!statusElement) return;
    
    if (isAutoReplyRunning) {
        statusElement.innerHTML = '<span class="text-green-600"><i class="fas fa-play-circle mr-1"></i>Berjalan</span>';
    } else {
        statusElement.innerHTML = '<span class="text-red-600"><i class="fas fa-stop-circle mr-1"></i>Berhenti</span>';
    }
    
    if (lastCheckElement) {
        lastCheckElement.textContent = `Terakhir dicek: ${new Date().toLocaleTimeString()}`;
    }
}

async function checkUnreadMessages() {

    if (isCheckingMessages) {
        console.log('⏳ Pengecekan pesan sedang berjalan, skip...');
        return;
    }

    await injectWAPIScript();
    addStatusLog('🔍 Memeriksa pesan yang belum dibaca...');
    isCheckingMessages = true;

    try {
        await ensureWebViewReady();

        const script = `
        (async function() {
            try {
                console.log('🔍 Starting WWebJS unread messages check...');
                
                if (typeof window.WWebJS === 'undefined') {
                    console.error('❌ WWebJS not available');
                    return [];
                }
                
                const unreadMessages = [];
                const chats = window.Store.Chat.getModelsArray();
                console.log(\`📱 Found \${chats.length} total chats\`);
                
                // Filter chat yang memiliki pesan belum dibaca
                const unreadChats = chats.filter(chat => {
                    return chat.unreadCount > 0;
                });
                
                console.log(\`📨 Found \${unreadChats.length} chats with unread messages\`);
                
                // Process each unread chat
                for (const chat of unreadChats) {
                    try {
                        const chatId = chat.id._serialized;
                        const isGroup = chatId.endsWith('@g.us');
                        const chatName = chat.name || chat.formattedTitle || chatId;
                        
                        console.log(\`💬 Processing chat: \${chatName} (unread: \${chat.unreadCount})\`);
                        
                        // Dapatkan pesan terakhir
                        let lastMessage = null;
                        
                        if (chat.lastReceivedKey) {
                            lastMessage = window.Store.Msg.get(chat.lastReceivedKey);
                        }
                        
                        // Jika tidak ada, ambil dari msgs models
                        if (!lastMessage && chat.msgs && chat.msgs.models && chat.msgs.models.length > 0) {
                            const messages = chat.msgs.models;
                            // Urutkan berdasarkan timestamp (terbaru pertama)
                            messages.sort((a, b) => (b.t || 0) - (a.t || 0));
                            lastMessage = messages[0];
                        }
                        
                        if (lastMessage && !lastMessage.__x_isSentByMe && !lastMessage.__x_isRead) {
                            let senderName = chatName;
                            let senderId = chatId;
                            
                            // Handle sender information
                            if (isGroup && lastMessage.__x_sender) {
                                const sender = lastMessage.__x_sender;
                                senderId = sender._serialized;
                                const contact = window.Store.Contact.get(senderId);
                                senderName = contact ? 
                                    (contact.name || contact.pushname || contact.formattedName || senderId.split('@')[0]) : 
                                    senderId.split('@')[0];
                            }
                            
                            // Tentukan jenis pesan
                            let messageContent = '';
                            if (lastMessage.body) {
                                messageContent = lastMessage.body;
                            } else if (lastMessage.type === 'image') {
                                messageContent = '🖼️ Gambar';
                            } else if (lastMessage.type === 'video') {
                                messageContent = '🎥 Video';
                            } else if (lastMessage.type === 'audio') {
                                messageContent = '🎵 Audio';
                            } else if (lastMessage.type === 'document') {
                                messageContent = '📄 Dokumen';
                            } else {
                                messageContent = \`[\${lastMessage.type}]\`;
                            }
                            
                            const messageData = {
                                from: senderId,
                                senderName: senderName,
                                body: messageContent,
                                chatId: chatId,
                                chatName: chatName,
                                timestamp: lastMessage.t ? lastMessage.t * 1000 : Date.now(),
                                isGroup: isGroup,
                                messageId: lastMessage.id._serialized,
                                unreadCount: chat.unreadCount,
                                messageType: lastMessage.type
                            };
                            
                            unreadMessages.push(messageData);
                            console.log(\`✅ Found unread message from \${senderName}: \${messageContent.substring(0, 50)}...\`);
                        }
                        
                    } catch (chatError) {
                        console.error('❌ Error processing chat:', chatError);
                    }
                }
                
                console.log(\`🎯 Final unread messages: \${unreadMessages.length}\`);
                return unreadMessages;
                
            } catch (error) {
                console.error('💥 WWebJS error:', error);
                return [];
            }
        })();
        `;
        
        const unreadMessages = await executeInWebView(script);
        
        if (unreadMessages && unreadMessages.length > 0) {
            addStatusLog(`📨 Ditemukan ${unreadMessages.length} pesan belum dibaca`);
            await processUnreadMessages(unreadMessages);
        } else {
            addStatusLog('✅ Tidak ada pesan baru yang belum dibaca');
        }
        
    } catch (error) {
        addStatusLog(`❌ Error memeriksa pesan: ${error.message}`);
        console.error('Check messages error:', error);
    } finally {
        isCheckingMessages = false;
        updateLastCheckTime();
    }
}

async function processUnreadMessages(messages) {
    let processedCount = 0;
    let repliedCount = 0;

    // ====== PERBAIKAN: Filter hanya pesan yang belum pernah diproses ======
    const newMessages = messages.filter(message => {
        const messageKey = message.messageId || `${message.from}_${message.timestamp}_${message.body.substring(0, 50)}`;
        
        // Cek apakah pesan sudah pernah diproses
        if (currentData.repliedMessageTracker.has(messageKey)) {
            console.log(`⏩ Skip pesan yang sudah diproses: ${messageKey}`);
            return false;
        }
        
        // Cek timestamp untuk mencegah duplikasi
        if (message.timestamp <= currentData.lastProcessedTimestamp) {
            console.log(`⏩ Skip pesan lama: ${new Date(message.timestamp).toLocaleTimeString()}`);
            return false;
        }
        
        return true;
    });

    console.log(`🎯 Memproses ${newMessages.length} pesan baru dari total ${messages.length} pesan`);

    for (const message of newMessages) {
        // Skip group messages if not enabled
        if (message.isGroup && !currentData.replySettings.replyToGroups) {
            console.log(`⏩ Skip pesan grup: ${message.from}`);
            continue;
        }

        const matchingRule = findMatchingRule(message);
        
        if (matchingRule) {
            // ====== PERBAIKAN: Tandai pesan sedang diproses SEBELUM mengirim ======
            const messageKey = message.messageId || `${message.from}_${message.timestamp}_${message.body.substring(0, 50)}`;
            currentData.repliedMessageTracker.add(messageKey);
            
            const success = await sendAutoReply(message, matchingRule);
            
            // Add to message log
            addToMessageLog(message, matchingRule, success);
            
            if (success) {
                repliedCount++;
                addStatusLog(`✅ Membalas pesan dari: ${message.senderName}`);
                
                // ====== PERBAIKAN: Update timestamp terakhir ======
                currentData.lastProcessedTimestamp = Math.max(currentData.lastProcessedTimestamp, message.timestamp);
            } else {
                addStatusLog(`❌ Gagal membalas pesan dari: ${message.senderName}`);
                // Jika gagal, hapus dari tracker agar bisa dicoba lagi nanti
                currentData.repliedMessageTracker.delete(messageKey);
            }
        }
        
        processedCount++;
        
        // Small delay between processing messages
        await delay(1000);
    }

    // Update statistics
    currentData.autoReplyStats.totalProcessed += processedCount;
    currentData.autoReplyStats.successCount += repliedCount;
    currentData.autoReplyStats.failCount += (processedCount - repliedCount);
    updateAutoReplyStats();

    const resultMessage = `Diproses: ${processedCount} pesan | Dibalas: ${repliedCount} pesan`;
    addStatusLog(`📊 ${resultMessage}`);

    // ====== PERBAIKAN: Bersihkan tracker jika terlalu banyak ======
    if (currentData.repliedMessageTracker.size > 1000) {
        console.log('🧹 Membersihkan repliedMessageTracker...');
        currentData.repliedMessageTracker.clear();
    }
}

function findMatchingRule(message) {
    for (const rule of currentData.replyRules) {
        // Skip inactive rules
        if (!rule.active) continue;
        
        // Check if rule applies to this specific number or all numbers
        if (rule.number && rule.number !== extractNumberFromChatId(message.from)) {
            continue;
        }
        
        // Check if message contains the keyword (case insensitive)
        if (rule.keyword && message.body.toLowerCase().includes(rule.keyword.toLowerCase())) {
            return rule;
        }
    }
    return null;
}

async function sendAutoReply(message, rule) {
    try {
        console.log('🚀 Starting auto reply...', {
            to: message.from,
            sender: message.senderName,
            keyword: rule.keyword,
            response: rule.response
        });
        
        await ensureWebViewReady();
        
        const targetId = message.from;
        let responseText = rule.response || 'Terima kasih atas pesan Anda.';
        
        // Replace variables in response
        responseText = responseText.replace(/{name}/g, message.senderName || 'Customer');
        
        console.log('📤 Sending reply to:', targetId);
        console.log('💬 Response text:', responseText);
        
        // ====== PERBAIKAN: Hanya 1x percobaan pengiriman ======
        const success = await sendTextMessage(targetId, responseText);
        
        console.log('✅ Auto reply result:', success);
        return success;
        
    } catch (error) {
        console.error('❌ Send auto reply error:', error);
        return false;
    }
}

function addToMessageLog(message, rule, success) {
    const logEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        from: message.from,
        senderName: message.senderName,
        incomingMessage: message.body,
        keyword: rule.keyword,
        response: rule.response,
        status: success ? 'success' : 'failed',
        isGroup: message.isGroup,
        messageId: message.messageId
    };
    
    currentData.messageLog.unshift(logEntry);
    
    // Keep only last 1000 entries
    if (currentData.messageLog.length > 1000) {
        currentData.messageLog = currentData.messageLog.slice(0, 1000);
    }
    
    saveAutoReplyData();
    displayMessageLog();
}

function displayMessageLog() {
    const tbody = document.getElementById('messageLogTableBody');
    if (!tbody) return;
    
    if (currentData.messageLog.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">
                    <i class="fas fa-inbox text-2xl text-slate-300 mb-2 block"></i>
                    Belum ada log pesan
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    currentData.messageLog.slice(0, 50).forEach((log, index) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const statusClass = log.status === 'success' ? 
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200' :
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200';
        
        html += `
            <tr class="message-log-row">
                <td class="px-4 py-3 text-sm text-slate-900 font-mono">${time}</td>
                <td class="px-4 py-3 text-sm text-slate-900">
                    <div class="max-w-xs truncate" title="${log.senderName}">${log.senderName}</div>
                    ${log.isGroup ? '<span class="text-xs text-blue-600 bg-blue-100 px-1 rounded">Group</span>' : ''}
                </td>
                <td class="px-4 py-3 text-sm text-slate-900">
                    <div class="max-w-xs truncate" title="${log.incomingMessage}">${log.incomingMessage}</div>
                    <div class="text-xs text-slate-500">Keyword: ${log.keyword}</div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-900">
                    <div class="max-w-xs truncate" title="${log.response}">${log.response}</div>
                </td>
                <td class="px-4 py-3 text-sm">
                    <span class="${statusClass}">
                        ${log.status === 'success' ? 'Berhasil' : 'Gagal'}
                    </span>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function updateLastCheckTime() {
    currentData.autoReplyStats.lastCheck = new Date().toISOString();
    const lastCheckElement = document.getElementById('autoReplyLastCheck');
    if (lastCheckElement) {
        lastCheckElement.textContent = `Terakhir dicek: ${new Date().toLocaleTimeString()}`;
    }
}

function updateAutoReplyStats() {
    const statsElement = document.getElementById('autoReplyStats');
    if (statsElement) {
        statsElement.textContent = 
            `Pesan diproses: ${currentData.autoReplyStats.totalProcessed} | ` +
            `Berhasil: ${currentData.autoReplyStats.successCount} | ` +
            `Gagal: ${currentData.autoReplyStats.failCount}`;
    }
}

function clearMessageLog() {
    if (currentData.messageLog.length === 0) {
        showNotification('Tidak ada log untuk dihapus', 'info');
        return;
    }
    
    if (confirm('Apakah Anda yakin ingin menghapus semua log pesan?')) {
        currentData.messageLog = [];
        currentData.repliedMessageTracker.clear();
        currentData.lastProcessedTimestamp = 0;
        saveAutoReplyData();
        displayMessageLog();
        addStatusLog('🗑️ Semua log pesan dihapus');
        showNotification('Log pesan berhasil dihapus', 'success');
    }
}

// ============================================================================
// FILE ATTACHMENT HANDLING
// ============================================================================

function handleFileAttachment(event) {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showNotification('File terlalu besar. Maksimal 10MB.', 'error');
        event.target.value = '';
        return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
        showNotification('Tipe file tidak didukung. Gunakan gambar, PDF, atau teks.', 'error');
        event.target.value = '';
        return;
    }

    currentData.automationSettings.attachment = {
        file: file,
        name: file.name,
        type: file.type,
        size: file.size
    };

    showAttachmentPreview(file);
    addStatusLog(`📎 Attachment dipilih: ${file.name} (${formatFileSize(file.size)})`);
    showNotification(`Attachment dipilih: ${file.name}`, 'success');
}

function showAttachmentPreview(file) {
    const preview = document.getElementById('attachmentPreview');
    if (!preview) return;

    preview.innerHTML = '';
    preview.classList.remove('hidden');

    if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = 'max-w-xs max-h-32 object-contain rounded-lg border border-slate-200 shadow-sm';
        img.onload = () => URL.revokeObjectURL(img.src);
        preview.appendChild(img);
    } else {
        const div = document.createElement('div');
        div.className = 'flex items-center space-x-3 p-4 bg-slate-100 rounded-lg border border-slate-200';
        div.innerHTML = `
            <i class="fas fa-file text-2xl text-slate-500"></i>
            <div>
                <div class="text-sm font-medium text-slate-800">${file.name}</div>
                <div class="text-xs text-slate-500">${formatFileSize(file.size)} • ${file.type}</div>
            </div>
        `;
        preview.appendChild(div);
    }

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.className = 'absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors';
    removeBtn.onclick = clearAttachment;
    removeBtn.title = 'Hapus attachment';
    preview.appendChild(removeBtn);
}

function clearAttachment() {
    const fileInput = document.getElementById('fileAttachment');
    const preview = document.getElementById('attachmentPreview');
    
    if (fileInput) fileInput.value = '';
    if (preview) {
        preview.innerHTML = '';
        preview.classList.add('hidden');
    }
    
    currentData.automationSettings.attachment = null;
    addStatusLog('📎 Attachment dihapus');
    showNotification('Attachment dihapus', 'info');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function executeInWebView(script) {
    await ensureWebViewReady();
    try {
        const result = await whatsappWebview.executeJavaScript(script, true);
        return result;
    } catch (error) {
        console.error('Execute in WebView error:', error);
        throw error;
    }
}

function showLoading(tableBodyId, message) {
    const tbody = document.getElementById(tableBodyId);
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-12 text-center text-sm text-slate-500">
                    <div class="flex flex-col items-center justify-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                        <div class="text-slate-600">${message}</div>
                        <div class="text-xs text-slate-400 mt-1">Harap tunggu...</div>
                    </div>
                </td>
            </tr>
        `;
    }
}

function addStatusLog(message) {
    const logContainer = document.getElementById('statusLog');
    if (!logContainer) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'text-xs text-slate-600 py-1 border-b border-slate-100 hover:bg-slate-50 transition-colors';
    logEntry.innerHTML = `<span class="text-slate-400">[${timestamp}]</span> ${message}`;
    
    if (logContainer.children.length === 1 && logContainer.children[0].classList.contains('text-center')) {
        logContainer.innerHTML = '';
    }
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateCount(elementId, count) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = count;
        element.classList.add('scale-110');
        setTimeout(() => {
            element.classList.remove('scale-110');
        }, 300);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-rose-500' : 
                   type === 'warning' ? 'bg-amber-500' : 
                   type === 'success' ? 'bg-emerald-500' : 'bg-blue-500';
    
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-0`;
    notification.innerHTML = `
        <div class="flex items-center space-x-2">
            <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 
                         type === 'warning' ? 'fa-exclamation-triangle' : 
                         type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span class="font-medium">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translate-x-full';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function extractNumberFromChatId(chatId) {
    if (!chatId) return '';
    if (chatId.endsWith('@c.us')) return chatId.replace('@c.us', '');
    if (chatId.endsWith('@g.us')) return chatId.replace('@g.us', '');
    return chatId;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
}

function downloadCSV(csvContent, filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
}

function generateId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function escapeJavaScriptString(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

// ============================================================================
// MESSAGE SENDING FUNCTIONS - DIPERBAIKI
// ============================================================================

async function sendTextMessage(chatId, message) {
    try {
        await ensureWebViewReady();
        
        console.log('🔧 Sending to:', chatId, 'Message:', message);

        const script = `
            (async function() {
                try {
                    const wid = window.Store.WidFactory.createWid("${chatId}");
                    const chatResult = await window.Store.FindOrCreateChat.findOrCreateLatestChat(wid);
                    
                    if (chatResult && chatResult.chat) {
                        const result = await window.WWebJS.sendMessage(chatResult.chat, "${message.replace(/"/g, '\\"')}");
                        return { success: true, messageId: result.id._serialized };
                    } else {
                        return { success: false, error: 'Chat not found' };
                    }
                } catch (error) {
                    console.error('Send message error:', error);
                    return { success: false, error: error.message };
                }
            })();
        `;

        const result = await executeInWebView(script);
        console.log('Send message result:', result);
        
        if (result && result.success) {
            console.log('✅ Message sent successfully:', result.messageId);
            return true;
        } else {
            console.error('❌ Failed to send message:', result?.error);
            return false;
        }
        
    } catch (error) {
        console.error('Send error:', error);
        return false;
    }
}

// ============================================================================
// WEBVIEW CONTROLS (Export to Window)
// ============================================================================

window.reloadWebView = function() {
    if (whatsappWebview) {
        whatsappWebview.reload();
        addStatusLog('🔄 Reloading WhatsApp Web...');
        isWebViewInitialized = false;
        webViewReadyPromise = null;
        setTimeout(initializeWebView, 1000);
    }
};

window.goBackWebView = function() {
    if (whatsappWebview && whatsappWebview.canGoBack()) {
        whatsappWebview.goBack();
    }
};

window.goForwardWebView = function() {
    if (whatsappWebview && whatsappWebview.canGoForward()) {
        whatsappWebview.goForward();
    }
};

window.openDevToolsWebView = function() {
    if (whatsappWebview) {
        whatsappWebview.openDevTools();
        addStatusLog('🔧 Membuka DevTools untuk WebView...');
    }
};

window.openWebViewDevTools = openDevToolsWebView;

window.debugPersistence = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get('accountId');
    console.log('=== 🐛 DEBUG PERSISTENCE ===');
    console.log('Account ID:', accountId);
    console.log('WebView Partition:', whatsappWebview?.partition);
    console.log('Is WebView Ready:', isWebViewInitialized);
    console.log('==========================');
};

// ============================================================================
// AUTO REPLY WINDOW FUNCTIONS
// ============================================================================

window.startAutoReply = startAutoReply;
window.stopAutoReply = stopAutoReply;
window.checkUnreadMessages = checkUnreadMessages;
window.clearMessageLog = clearMessageLog;

// ====== PERBAIKAN: Tambahkan function untuk reset tracker ======
window.resetReplyTracker = function() {
    currentData.repliedMessageTracker.clear();
    currentData.lastProcessedTimestamp = 0;
    addStatusLog('🔄 Reply tracker direset');
    showNotification('Reply tracker berhasil direset', 'success');
};

console.log('✅ WhatsApp Blaze core renderer dengan auto reply start/stop loaded successfully');