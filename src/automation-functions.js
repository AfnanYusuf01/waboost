// WhatsApp Blaze - Automation Functions (FIXED)

// ============================================================================
// MESSAGE SENDING FUNCTIONS
// ============================================================================

async function sendToContacts() {
    const selectedContacts = getSelectedSendingContacts();
    if (selectedContacts.length === 0) {
        showNotification('Pilih kontak terlebih dahulu!', 'warning');
        return;
    }

    if (!currentData.automationSettings.message.trim() && !currentData.automationSettings.attachment) {
        showNotification('Masukkan pesan atau pilih attachment terlebih dahulu!', 'warning');
        return;
    }

    addStatusLog('📤 Memulai pengiriman ke kontak...');
    await startSendingProcess(selectedContacts, false);
}

async function sendToGroups() {
    const selectedGroups = getSelectedSendingGroups();
    if (selectedGroups.length === 0) {
        showNotification('Pilih grup terlebih dahulu!', 'warning');
        return;
    }

    if (!currentData.automationSettings.message.trim() && !currentData.automationSettings.attachment) {
        showNotification('Masukkan pesan atau pilih attachment terlebih dahulu!', 'warning');
        return;
    }

    addStatusLog('📤 Memulai pengiriman ke grup...');
    await startSendingProcess(selectedGroups, true);
}

async function startSendingProcess(targets, isGroup) {
    if (isSending) {
        showNotification('Pengiriman sudah berjalan!', 'warning');
        return;
    }

    isSending = true;
    isPaused = false;
    isStopped = false;
    currentSendingIndex = 0;

    const totalTargets = targets.length;
    let successCount = 0;
    let failCount = 0;

    addStatusLog(`🚀 Memulai pengiriman ke ${totalTargets} ${isGroup ? 'grup' : 'kontak'}`);
    showNotification(`Memulai pengiriman ke ${totalTargets} target`, 'info');

    try {
        for (let i = 0; i < totalTargets; i++) {
            if (isStopped) {
                addStatusLog('⏹️ Pengiriman dihentikan');
                showNotification('Pengiriman dihentikan', 'warning');
                break;
            }

            if (isPaused) {
                addStatusLog('⏸️ Pengiriman dijeda');
                showNotification('Pengiriman dijeda', 'info');
                await waitForResume();
                if (isStopped) break;
                showNotification('Pengiriman dilanjutkan', 'info');
            }

            currentSendingIndex = i;
            const target = targets[i];

            try {
                updateSendingStatus(target.id, 'Mengirim...', isGroup);
                addStatusLog(`📤 Mengirim ke: ${target.name || target.number}`);

                const success = await sendSingleMessage(target, isGroup);

                if (success) {
                    successCount++;
                    updateSendingStatus(target.id, 'Berhasil', isGroup);
                    addStatusLog(`✅ Berhasil kirim ke: ${target.name || target.number}`);
                } else {
                    failCount++;
                    updateSendingStatus(target.id, 'Gagal', isGroup);
                    addStatusLog(`❌ Gagal kirim ke: ${target.name || target.number}`);
                }

                updateProgress(i + 1, totalTargets, successCount, failCount);

                if (i < totalTargets - 1) {
                    await applyDelays(i);
                }

            } catch (error) {
                failCount++;
                updateSendingStatus(target.id, 'Error', isGroup);
                addStatusLog(`❌ Error kirim ke ${target.name || target.number}: ${error.message}`);
                console.error('Send error:', error);
            }
        }

        if (isStopped) {
            const message = `⏹️ Pengiriman dihentikan. Berhasil: ${successCount}, Gagal: ${failCount}`;
            addStatusLog(message);
            showNotification(message, 'warning');
        } else {
            const message = `🎉 Pengiriman selesai! Berhasil: ${successCount}, Gagal: ${failCount}`;
            addStatusLog(message);
            showNotification(message, 'success');
        }

    } catch (error) {
        addStatusLog(`💥 Error sistem: ${error.message}`);
        showNotification('Error sistem saat pengiriman', 'error');
    } finally {
        isSending = false;
        isPaused = false;
        isStopped = false;
        currentSendingIndex = 0;
    }
}

async function sendSingleMessage(target, isGroup) {
    await ensureWebViewReady();
    
    const message = processMessageTemplate(currentData.automationSettings.message, target);
    
    let targetId = target.id;
    
    if (isGroup) {
        if (!targetId.endsWith('@g.us')) {
            targetId = `${targetId}@g.us`;
        }
    } else {
        if (!targetId.endsWith('@c.us')) {
            targetId = `${targetId}@c.us`;
        }
    }

    console.log(`Sending to ${targetId}:`, message.substring(0, 50) + '...');

    try {
        if (currentData.automationSettings.attachment) {
            return await sendMessageWithAttachment(targetId, message);
        } else {
            return await sendTextMessage(targetId, message);
        }
    } catch (error) {
        console.error('Send message error:', error);
        return false;
    }
}

async function sendTextMessage(chatId, message) {
    try {
        await ensureWebViewReady();
        await injectWAPIScript();
        
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

async function sendMessageWithAttachment(targetId, message) {
    await injectWAPIScript();
    try {
        // Convert file to base64 menggunakan method yang sama seperti createAttachmentTester
        const base64Data = await fileToBase64Safe(currentData.automationSettings.attachment.file);
        const fileName = currentData.automationSettings.attachment.name || 'file';
        const mimeType = currentData.automationSettings.attachment.file.type || getMimeTypeFromFilename(fileName);

        const script = `
            (async function() {
                try {
                    console.log('🔄 Starting attachment send to ${targetId}');
                    
                    // Validasi target ID
                    function validateTargetId(targetId) {
                        if (!targetId) return 'ID target tidak boleh kosong';
                        if (!targetId.includes('@')) return 'ID target harus mengandung @';
                        if (!targetId.endsWith('@c.us') && !targetId.endsWith('@g.us')) {
                            return 'ID target harus berakhiran @c.us atau @g.us';
                        }
                        return null;
                    }
                    
                    const validationError = validateTargetId('${targetId}');
                    if (validationError) {
                        console.error('❌ Validation error:', validationError);
                        return { success: false, error: validationError };
                    }
                    
                    // Dapatkan chat
                    let chat;
                    try {
                        chat = await window.WWebJS.getChat('${targetId}', { getAsModel: false });
                        if (!chat) {
                            throw new Error('Chat tidak ditemukan');
                        }
                        console.log('✅ Chat found:', chat.id._serialized);
                    } catch (chatError) {
                        console.error('❌ Failed to get chat:', chatError);
                        return { success: false, error: 'Gagal mendapatkan chat: ' + chatError.message };
                    }
                    
                    // Buat media info (sama seperti createAttachmentTester)
                    const mediaInfo = {
                        data: '${base64Data}',
                        mimetype: '${mimeType}',
                        filename: '${fileName}'
                    };
                    
                    console.log('🔄 Sending message with attachment...');
                    const result = await window.WWebJS.sendMessage(chat, '${message.replace(/'/g, "\\'")}', {
                        media: mediaInfo,
                        caption: '${message.replace(/'/g, "\\'")}'
                    });
                    
                    console.log('✅ Attachment sent successfully');
                    return { 
                        success: true, 
                        messageId: result.id._serialized
                    };
                    
                } catch (error) {
                    console.error('❌ Send attachment error:', error);
                    return { success: false, error: error.message };
                }
            })();
        `;

        console.log('🔄 Executing attachment send script for:', targetId);
        const result = await executeInWebView(script);
        console.log('📨 Attachment send result:', result);
        
        if (result && result.success === true) {
            console.log('✅ Attachment berhasil dikirim ke', targetId);
            return true;
        } else {
            console.error('❌ Gagal mengirim attachment ke', targetId, 'Error:', result?.error);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Send attachment error:', error);
        return false;
    }
}

// Function untuk handle base64 conversion dengan benar (sama seperti createAttachmentTester)
function fileToBase64Safe(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Return pure base64 tanpa data URL prefix (sama seperti createAttachmentTester)
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Helper function untuk menentukan MIME type dari filename
function getMimeTypeFromFilename(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'txt': 'text/plain',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

async function debugWAPI() {
    try {
        await ensureWebViewReady();
        
        const debugScript = `
            (function() {
                try {
                    console.log('=== 🔍 WAPI DEBUG INFO ===');
                    
                    const debugInfo = {
                        isWAPIDefined: typeof window.WAPI !== 'undefined',
                        availableFunctions: [],
                        storeStatus: typeof window.Store !== 'undefined',
                        chatStatus: typeof window.Store?.Chat !== 'undefined',
                        wwebjsStatus: typeof window.WWebJS !== 'undefined'
                    };

                    if (debugInfo.isWAPIDefined) {
                        debugInfo.availableFunctions = Object.keys(window.WAPI).filter(key => 
                            typeof window.WAPI[key] === 'function'
                        );
                    }

                    // Test WWebJS functions
                    if (debugInfo.wwebjsStatus) {
                        debugInfo.wwebjsFunctions = Object.keys(window.WWebJS).filter(key => 
                            typeof window.WWebJS[key] === 'function'
                        );
                    }

                    console.log('WAPI Debug Info:', debugInfo);
                    
                    // Test if we can access chat list
                    if (window.Store && window.Store.Chat) {
                        try {
                            const chats = window.Store.Chat.getModelsArray ? 
                                window.Store.Chat.getModelsArray() : 
                                (window.Store.Chat._models || []);
                            debugInfo.chatCount = chats.length;
                            debugInfo.groupChats = chats.filter(chat => 
                                chat.id?._serialized?.endsWith('@g.us')
                            ).length;
                            debugInfo.contactChats = chats.filter(chat => 
                                chat.id?._serialized?.endsWith('@c.us')
                            ).length;
                            
                            // Test getChat function
                            if (chats.length > 0) {
                                const testChat = chats[0];
                                debugInfo.testChatId = testChat.id._serialized;
                                debugInfo.testChatName = testChat.name || testChat.formattedTitle;
                            }
                        } catch (chatError) {
                            debugInfo.chatError = chatError.message;
                        }
                    }

                    return debugInfo;
                    
                } catch (error) {
                    return { error: error.message };
                }
            })();
        `;

        const debugInfo = await executeInWebView(debugScript);
        console.log('🔍 WAPI Debug Results:', debugInfo);
        
        return debugInfo;
        
    } catch (error) {
        console.error('Debug WAPI error:', error);
        return null;
    }
}

// Export ke window
window.debugWAPI = debugWAPI;

// Function untuk test connection WWebJS
function testWWebJSConnection() {
    console.log('🔍 Testing WWebJS connection...');
    
    try {
        // Test if WWebJS is available
        if (typeof window.WWebJS === 'undefined') {
            console.error('❌ WWebJS tidak tersedia');
            return false;
        }
        
        // Test if getChat works
        const testChat = window.Store.Chat.getModelsArray()[0];
        if (testChat) {
            console.log('✅ WWebJS connected - Chat found:', testChat.id._serialized);
            return true;
        } else {
            console.log('⚠️ WWebJS connected but no chats found');
            return true;
        }
    } catch (error) {
        console.error('❌ WWebJS test failed:', error);
        return false;
    }
}

function processMessageTemplate(message, target) {
    let processed = message;
    
    if (target.name && processed.includes('{name}')) {
        processed = processed.replace(/{name}/g, target.name);
    }
    if (target.number && processed.includes('{number}')) {
        processed = processed.replace(/{number}/g, target.number);
    }
    if (target.memberOf && processed.includes('{group}')) {
        processed = processed.replace(/{group}/g, target.memberOf);
    }
    
    return processed;
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

async function applyDelays(currentIndex) {
    const settings = currentData.automationSettings;
    
    if (settings.sleepAfter > 0 && (currentIndex + 1) % settings.sleepAfter === 0) {
        const sleepSeconds = settings.sleepMinutes * 60;
        addStatusLog(`😴 Sleep ${settings.sleepMinutes} menit setelah ${settings.sleepAfter} pesan`);
        showNotification(`Sleep ${settings.sleepMinutes} menit`, 'info');
        
        for (let seconds = 0; seconds < sleepSeconds; seconds++) {
            if (isStopped || isPaused) break;
            if (seconds % 30 === 0) {
                addStatusLog(`⏰ Sleep: ${Math.ceil((sleepSeconds - seconds) / 60)} menit lagi`);
            }
            await delay(1000);
        }
        
        if (!isStopped && !isPaused) {
            addStatusLog('✅ Sleep selesai, melanjutkan pengiriman...');
        }
    } else {
        const min = Math.min(settings.minDelay, settings.maxDelay);
        const max = Math.max(settings.minDelay, settings.maxDelay);
        const delaySeconds = Math.floor(Math.random() * (max - min + 1)) + min;
        
        addStatusLog(`⏳ Delay ${delaySeconds} detik`);
        await delay(delaySeconds * 1000);
    }
}

async function waitForResume() {
    return new Promise((resolve) => {
        const checkResume = setInterval(() => {
            if (!isPaused || isStopped) {
                clearInterval(checkResume);
                resolve();
            }
        }, 500);
    });
}

function pauseSending() {
    if (!isSending) {
        showNotification('Tidak ada pengiriman yang berjalan', 'warning');
        return;
    }
    
    isPaused = true;
    addStatusLog('⏸️ Pengiriman dijeda');
    showNotification('Pengiriman dijeda', 'info');
}

function resumeSending() {
    if (!isSending) {
        showNotification('Tidak ada pengiriman yang berjalan', 'warning');
        return;
    }
    
    isPaused = false;
    addStatusLog('▶️ Pengiriman dilanjutkan');
    showNotification('Pengiriman dilanjutkan', 'info');
}

function stopSending() {
    if (!isSending) {
        showNotification('Tidak ada pengiriman yang berjalan', 'warning');
        return;
    }
    
    isStopped = true;
    isPaused = false;
    addStatusLog('⏹️ Pengiriman dihentikan');
    showNotification('Pengiriman dihentikan', 'warning');
}

function updateSendingStatus(targetId, status, isGroup = false) {
    const selector = isGroup ? `[data-group-id="${targetId}"]` : `[data-contact-id="${targetId}"]`;
    const row = document.querySelector(selector);
    
    if (row) {
        const statusCell = row.querySelector('.status-cell');
        if (statusCell) {
            statusCell.textContent = status;
            statusCell.className = `status-cell ${getStatusClass(status)}`;
            
            const statusData = isGroup ? currentData.sendingGroups : currentData.sendingContacts;
            const item = statusData.find(item => item.id === targetId);
            if (item) {
                item.status = status;
            }
        }
    }
}

function getStatusClass(status) {
    switch (status) {
        case 'Berhasil': 
            return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200';
        case 'Gagal': 
            return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200';
        case 'Mengirim': 
            return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200';
        case 'Error': 
            return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200';
        default: 
            return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200';
    }
}

function updateProgress(current, total, success, fail) {
    const progress = Math.round((current / total) * 100);
    addStatusLog(`📊 Progress: ${current}/${total} (${progress}%) | ✅ ${success} | ❌ ${fail}`);
    
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${progress}%`;
    }
}

// ============================================================================
// DATA LOADING FOR SENDING
// ============================================================================

function loadContactsForSending() {
    addStatusLog('📥 Memuat kontak untuk pengiriman...');
    if (currentData.contacts.length > 0) {
        exportContactsToTarget();
    } else {
        showNotification('Tidak ada kontak yang dimuat. Load kontak terlebih dahulu.', 'warning');
    }
}

function loadGroupsForSending() {
    addStatusLog('📥 Memuat grup untuk pengiriman...');
    if (currentData.groups.length > 0) {
        exportGroupsToTarget();
    } else {
        showNotification('Tidak ada grup yang dimuat. Load grup terlebih dahulu.', 'warning');
    }
}

// ============================================================================
// TABLE DISPLAY FUNCTIONS
// ============================================================================

function displaySendingContactsTable(contacts, append = false) {
    const tbody = document.getElementById('sendingContactsTableBody');
    if (!tbody) return;
    
    if (!append) {
        tbody.innerHTML = '';
    }
    
    if ((!contacts || contacts.length === 0) && !append) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">
                    <i class="fas fa-users text-2xl text-slate-300 mb-2 block"></i>
                    Tidak ada kontak untuk dikirim
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    const contactsToDisplay = append ? contacts : currentData.sendingContacts;
    
    contactsToDisplay.forEach(contact => {
        const isSelected = currentData.selectedSendingContacts.has(contact.id);
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-purple-50' : ''}" 
                data-contact-id="${contact.id}">
                <td class="px-4 py-3 text-sm text-slate-900">
                    <input type="checkbox" onchange="toggleSendingContactSelection('${contact.id}')"
                           ${isSelected ? 'checked' : ''}
                           class="rounded border-slate-300 text-purple-600 focus:ring-purple-500 transition-colors">
                </td>
                <td class="px-4 py-3 text-sm font-medium text-slate-900">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            ${contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div class="ml-3">
                            <div class="font-medium text-slate-900">${contact.name || 'Unknown'}</div>
                            ${contact.source ? `<div class="text-xs text-slate-500">${contact.source}</div>` : ''}
                            ${contact.memberOf ? `<div class="text-xs text-slate-400">${contact.memberOf}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-900 font-mono">${contact.number || contact.id}</td>
                <td class="px-4 py-3 text-sm">
                    <span class="status-cell ${getStatusClass(contact.status || 'Added')}">
                        ${contact.status || 'Added'}
                    </span>
                </td>
            </tr>
        `;
    });
    
    if (append) {
        tbody.innerHTML += html;
    } else {
        tbody.innerHTML = html;
    }
}

function displaySendingGroupsTable(groups, append = false) {
    const tbody = document.getElementById('sendingGroupsTableBody');
    if (!tbody) return;
    
    if (!append) {
        tbody.innerHTML = '';
    }
    
    if ((!groups || groups.length === 0) && !append) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">
                    <i class="fas fa-users text-2xl text-slate-300 mb-2 block"></i>
                    Tidak ada grup untuk dikirim
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    const groupsToDisplay = append ? groups : currentData.sendingGroups;
    
    groupsToDisplay.forEach(group => {
        const isSelected = currentData.selectedSendingGroups.has(group.id);
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-purple-50' : ''}" 
                data-group-id="${group.id}">
                <td class="px-4 py-3 text-sm text-slate-900">
                    <input type="checkbox" onchange="toggleSendingGroupSelection('${group.id}')"
                           ${isSelected ? 'checked' : ''}
                           class="rounded border-slate-300 text-purple-600 focus:ring-purple-500 transition-colors">
                </td>
                <td class="px-4 py-3 text-sm font-medium text-slate-900">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="ml-3">
                            <div class="font-medium text-slate-900">${group.name || 'Unknown Group'}</div>
                            <div class="text-xs text-slate-500">${group.participantCount || 0} members</div>
                            ${group.source ? `<div class="text-xs text-slate-400">${group.source}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-900 font-mono">${group.id}</td>
                <td class="px-4 py-3 text-sm">
                    <span class="status-cell ${getStatusClass(group.status || 'Pending')}">
                        ${group.status || 'Pending'}
                    </span>
                </td>
            </tr>
        `;
    });
    
    if (append) {
        tbody.innerHTML += html;
    } else {
        tbody.innerHTML = html;
    }
}

// ============================================================================
// SELECTION FUNCTIONS
// ============================================================================

function getSelectedSendingContacts() {
    const selected = [];
    const checkboxes = document.querySelectorAll('#sendingContactsTableBody input[type="checkbox"]:checked');
    
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const contactId = row.getAttribute('data-contact-id');
        const contact = currentData.sendingContacts.find(c => c.id === contactId);
        if (contact) {
            selected.push(contact);
        }
    });
    
    return selected;
}

function getSelectedSendingGroups() {
    const selected = [];
    const checkboxes = document.querySelectorAll('#sendingGroupsTableBody input[type="checkbox"]:checked');
    
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const groupId = row.getAttribute('data-group-id');
        const group = currentData.sendingGroups.find(g => g.id === groupId);
        if (group) {
            selected.push(group);
        }
    });
    
    return selected;
}

function toggleSendingContactSelection(contactId) {
    if (currentData.selectedSendingContacts.has(contactId)) {
        currentData.selectedSendingContacts.delete(contactId);
    } else {
        currentData.selectedSendingContacts.add(contactId);
    }
    
    updateSelectAllSendingContactsCheckbox();
}

function toggleSendingGroupSelection(groupId) {
    if (currentData.selectedSendingGroups.has(groupId)) {
        currentData.selectedSendingGroups.delete(groupId);
    } else {
        currentData.selectedSendingGroups.add(groupId);
    }
    
    updateSelectAllSendingGroupsCheckbox();
}

function toggleSelectAllSendingContacts() {
    const selectAll = document.getElementById('selectAllSendingContacts');
    const checkboxes = document.querySelectorAll('#sendingContactsTableBody input[type="checkbox"]');
    
    if (selectAll.checked) {
        currentData.sendingContacts.forEach(contact => {
            currentData.selectedSendingContacts.add(contact.id);
        });
    } else {
        currentData.selectedSendingContacts.clear();
    }
    
    checkboxes.forEach(checkbox => {
        const contactId = checkbox.getAttribute('onchange').match(/'([^']+)'/)[1];
        checkbox.checked = currentData.selectedSendingContacts.has(contactId);
    });
}

function toggleSelectAllSendingGroups() {
    const selectAll = document.getElementById('selectAllSendingGroups');
    const checkboxes = document.querySelectorAll('#sendingGroupsTableBody input[type="checkbox"]');
    
    if (selectAll.checked) {
        currentData.sendingGroups.forEach(group => {
            currentData.selectedSendingGroups.add(group.id);
        });
    } else {
        currentData.selectedSendingGroups.clear();
    }
    
    checkboxes.forEach(checkbox => {
        const groupId = checkbox.getAttribute('onchange').match(/'([^']+)'/)[1];
        checkbox.checked = currentData.selectedSendingGroups.has(groupId);
    });
}

function updateSelectAllSendingContactsCheckbox() {
    const selectAll = document.getElementById('selectAllSendingContacts');
    if (selectAll) {
        const totalContacts = currentData.sendingContacts.length;
        const selectedContacts = currentData.selectedSendingContacts.size;
        selectAll.checked = totalContacts > 0 && selectedContacts === totalContacts;
        selectAll.indeterminate = totalContacts > 0 && selectedContacts > 0 && selectedContacts < totalContacts;
    }
}

function updateSelectAllSendingGroupsCheckbox() {
    const selectAll = document.getElementById('selectAllSendingGroups');
    if (selectAll) {
        const totalGroups = currentData.sendingGroups.length;
        const selectedGroups = currentData.selectedSendingGroups.size;
        selectAll.checked = totalGroups > 0 && selectedGroups === totalGroups;
        selectAll.indeterminate = totalGroups > 0 && selectedGroups > 0 && selectedGroups < totalGroups;
    }
}

// ============================================================================
// EXPORT FUNCTIONS TO WINDOW OBJECT
// ============================================================================

window.sendToContacts = sendToContacts;
window.sendToGroups = sendToGroups;
window.pauseSending = pauseSending;
window.resumeSending = resumeSending;
window.stopSending = stopSending;

window.loadContactsForSending = loadContactsForSending;
window.loadGroupsForSending = loadGroupsForSending;

window.toggleSendingContactSelection = toggleSendingContactSelection;
window.toggleSendingGroupSelection = toggleSendingGroupSelection;
window.toggleSelectAllSendingContacts = toggleSelectAllSendingContacts;
window.toggleSelectAllSendingGroups = toggleSelectAllSendingGroups;

window.testWWebJSConnection = testWWebJSConnection;

console.log('✅ WhatsApp Blaze automation functions loaded successfully');