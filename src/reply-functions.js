// WhatsApp Blaze - Reply Functions (Diperbaiki dengan Start/Stop System)

// ============================================================================
// REPLY SETTINGS MANAGEMENT
// ============================================================================

function loadReplySettings() {
    // Load settings dari currentData ke form
    const settings = currentData.replySettings;
    
    console.log('🔧 Loading reply settings:', settings);
    
    // Set form fields - TIDAK PERLU RADIO BUTTONS LAGI
    const checkInterval = document.getElementById('checkInterval');
    const replyToGroups = document.getElementById('replyToGroups');
    const replyToUnknown = document.getElementById('replyToUnknown');
    
    if (checkInterval) checkInterval.value = settings.delay;
    if (replyToGroups) replyToGroups.checked = settings.replyToGroups;
    if (replyToUnknown) replyToUnknown.checked = settings.replyToUnknown;
    
    console.log('✅ Form fields set:', {
        delay: settings.delay,
        replyToGroups: settings.replyToGroups,
        replyToUnknown: settings.replyToUnknown
    });
}

function saveReplySettings() {
    try {
        // Get values from form
        const delay = parseInt(document.getElementById('checkInterval').value) || 5;
        const replyToGroups = document.getElementById('replyToGroups').checked;
        const replyToUnknown = document.getElementById('replyToUnknown').checked;

        // Save to currentData
        currentData.replySettings = {
            ...currentData.replySettings,
            delay,
            replyToGroups,
            replyToUnknown
        };

        // Save to localStorage
        saveAutoReplyData();
        
        addStatusLog('✅ Settings Auto Reply berhasil disimpan');
        showNotification('Settings Auto Reply berhasil disimpan', 'success');
        
        console.log('Reply settings saved:', currentData.replySettings);
        
        // Jika auto reply sedang berjalan, restart dengan interval baru
        if (typeof isAutoReplyRunning !== 'undefined' && isAutoReplyRunning) {
            if (typeof restartAutoReply !== 'undefined') {
                restartAutoReply();
            }
        }
        
    } catch (error) {
        addStatusLog('❌ Gagal menyimpan settings: ' + error.message);
        showNotification('Gagal menyimpan settings', 'error');
    }
}

// ============================================================================
// REPLY RULES MANAGEMENT
// ============================================================================

function loadReplyRules() {
    displayReplyRulesTable(currentData.replyRules);
}

function displayReplyRulesTable(rules) {
    const tbody = document.getElementById('replyRulesTableBody');
    if (!tbody) return;
    
    if (!rules || rules.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-sm text-slate-500">
                    <i class="fas fa-inbox text-2xl text-slate-300 mb-2 block"></i>
                    Belum ada rules yang dibuat
                    <br>
                    <button onclick="addNewRule()" 
                            class="mt-2 text-green-600 hover:text-green-700 text-sm font-medium">
                        Klik untuk menambahkan rule pertama
                    </button>
                </td>
            </tr>
        `;
        updateCount('replyRulesCount', 0);
        return;
    }
    
    let html = '';
    rules.forEach((rule, index) => {
        const statusBadge = rule.active ? 
            '<span class="status-badge status-active">Aktif</span>' :
            '<span class="status-badge status-inactive">Nonaktif</span>';
        
        html += `
            <tr class="rule-row hover:bg-slate-50 transition-colors" data-rule-id="${rule.id}">
                <td class="px-4 py-3 text-sm text-slate-900 text-center">${index + 1}</td>
                <td class="px-4 py-3 text-sm text-slate-900 font-mono">
                    ${rule.number || '<span class="text-slate-400">Semua</span>'}
                </td>
                <td class="px-4 py-3 text-sm text-slate-900">
                    <div class="max-w-xs truncate" title="${rule.keyword}">${rule.keyword}</div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-900">
                    <div class="max-w-xs truncate" title="${rule.response}">${rule.response}</div>
                </td>
                <td class="px-4 py-3 text-sm text-center">${statusBadge}</td>
                <td class="px-4 py-3 text-sm">
                    <div class="flex space-x-1">
                        <button onclick="toggleRuleStatus('${rule.id}')" 
                                class="p-1 ${rule.active ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'} transition-colors smooth-transition" 
                                title="${rule.active ? 'Nonaktifkan' : 'Aktifkan'}">
                            <i class="fas ${rule.active ? 'fa-pause' : 'fa-play'} text-sm"></i>
                        </button>
                        <button onclick="editRule('${rule.id}')" 
                                class="p-1 text-blue-600 hover:text-blue-800 transition-colors smooth-transition" 
                                title="Edit Rule">
                            <i class="fas fa-edit text-sm"></i>
                        </button>
                        <button onclick="deleteRule('${rule.id}')" 
                                class="p-1 text-rose-600 hover:text-rose-800 transition-colors smooth-transition" 
                                title="Delete Rule">
                            <i class="fas fa-trash text-sm"></i>
                        </button>
                        <button onclick="testRule('${rule.id}')" 
                                class="p-1 text-purple-600 hover:text-purple-800 transition-colors smooth-transition" 
                                title="Test Rule">
                            <i class="fas fa-vial text-sm"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    updateCount('replyRulesCount', rules.length);
}

function addNewRule() {
    const newRule = {
        id: generateRuleId(),
        number: '', // Empty means all numbers
        keyword: '',
        response: '',
        active: true,
        createdAt: new Date().toISOString()
    };
    
    currentData.replyRules.push(newRule);
    saveAutoReplyData();
    displayReplyRulesTable(currentData.replyRules);
    
    // Switch to edit mode
    setTimeout(() => editRule(newRule.id), 100);
    
    addStatusLog('➕ Rule baru ditambahkan');
    showNotification('Rule baru ditambahkan', 'success');
}

function editRule(ruleId) {
    const rule = currentData.replyRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    // Create modal for editing
    const modalHtml = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-t-2xl">
                    <h3 class="text-lg font-bold flex items-center">
                        <i class="fas fa-edit mr-2"></i>
                        ${rule.number ? 'Edit Rule' : 'Edit Rule Global'}
                    </h3>
                </div>
                
                <div class="p-6 space-y-4">
                    <!-- Number Input -->
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">
                            <i class="fas fa-phone mr-1 text-blue-500"></i>
                            Nomor Tujuan (kosongkan untuk semua nomor)
                        </label>
                        <input type="text" id="editRuleNumber" 
                               value="${rule.number || ''}"
                               class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 font-mono"
                               placeholder="628123456789">
                        <p class="text-xs text-slate-500 mt-1">Biarkan kosong untuk menerapkan ke semua nomor</p>
                    </div>
                    
                    <!-- Keyword Input -->
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">
                            <i class="fas fa-key mr-1 text-purple-500"></i>
                            Keyword
                        </label>
                        <input type="text" id="editRuleKeyword" 
                               value="${rule.keyword}"
                               class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                               placeholder="halo, harga, info, dll.">
                        <p class="text-xs text-slate-500 mt-1">Pesan akan dibalas jika mengandung keyword ini</p>
                    </div>
                    
                    <!-- Response Text -->
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">
                            <i class="fas fa-comment mr-1 text-green-500"></i>
                            Response Text
                        </label>
                        <textarea id="editRuleResponse" 
                                  class="w-full h-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 resize-none"
                                  placeholder="Teks yang akan dikirim sebagai balasan...">${rule.response}</textarea>
                        <p class="text-xs text-slate-500 mt-1">Gunakan variabel {name} untuk nama pengirim</p>
                    </div>
                    
                    <!-- Active Toggle -->
                    <div>
                        <label class="flex items-center">
                            <input type="checkbox" id="editRuleActive" 
                                   ${rule.active ? 'checked' : ''}
                                   class="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded">
                            <span class="ml-2 text-sm text-slate-700">Rule aktif</span>
                        </label>
                    </div>
                </div>
                
                <div class="p-6 border-t border-slate-200 flex justify-end space-x-3">
                    <button onclick="closeEditModal()" 
                            class="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors font-medium">
                        Batal
                    </button>
                    <button onclick="saveRule('${rule.id}')" 
                            class="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-2 rounded-lg transition-all duration-200 shadow hover:shadow-lg flex items-center">
                        <i class="fas fa-save mr-2"></i>
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('editRuleModal');
    if (existingModal) existingModal.remove();
    
    // Add new modal
    const modalContainer = document.createElement('div');
    modalContainer.id = 'editRuleModal';
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
}

function closeEditModal() {
    const modal = document.getElementById('editRuleModal');
    if (modal) modal.remove();
}

function saveRule(ruleId) {
    const rule = currentData.replyRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    try {
        // Get values from form
        rule.number = document.getElementById('editRuleNumber').value.trim();
        rule.keyword = document.getElementById('editRuleKeyword').value.trim();
        rule.response = document.getElementById('editRuleResponse').value.trim();
        rule.active = document.getElementById('editRuleActive').checked;
        
        // Validate required fields
        if (!rule.keyword) {
            showNotification('Keyword tidak boleh kosong', 'error');
            return;
        }
        
        if (!rule.response) {
            showNotification('Response text tidak boleh kosong', 'error');
            return;
        }
        
        closeEditModal();
        saveAutoReplyData();
        displayReplyRulesTable(currentData.replyRules);
        
        addStatusLog('✅ Rule berhasil disimpan');
        showNotification('Rule berhasil disimpan', 'success');
        
    } catch (error) {
        addStatusLog('❌ Gagal menyimpan rule: ' + error.message);
        showNotification('Gagal menyimpan rule', 'error');
    }
}

function toggleRuleStatus(ruleId) {
    const rule = currentData.replyRules.find(r => r.id === ruleId);
    if (rule) {
        rule.active = !rule.active;
        saveAutoReplyData();
        displayReplyRulesTable(currentData.replyRules);
        
        const status = rule.active ? 'diaktifkan' : 'dinonaktifkan';
        addStatusLog(`🔧 Rule "${rule.keyword}" ${status}`);
        showNotification(`Rule ${status}`, 'info');
    }
}

function deleteRule(ruleId) {
    const rule = currentData.replyRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    if (!confirm(`Apakah Anda yakin ingin menghapus rule untuk keyword "${rule.keyword}"?`)) return;
    
    currentData.replyRules = currentData.replyRules.filter(r => r.id !== ruleId);
    saveAutoReplyData();
    displayReplyRulesTable(currentData.replyRules);
    
    addStatusLog('🗑️ Rule berhasil dihapus');
    showNotification('Rule berhasil dihapus', 'success');
}

function testRule(ruleId) {
    const rule = currentData.replyRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    // Create test modal
    const modalHtml = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div class="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6 rounded-t-2xl">
                    <h3 class="text-lg font-bold flex items-center">
                        <i class="fas fa-vial mr-2"></i>
                        Test Rule
                    </h3>
                </div>
                
                <div class="p-6 space-y-4">
                    <div class="bg-slate-50 rounded-lg p-4">
                        <h4 class="font-semibold text-slate-800 mb-2">Rule Details:</h4>
                        <div class="text-sm space-y-1">
                            <div><span class="font-medium">Keyword:</span> ${rule.keyword}</div>
                            <div><span class="font-medium">Response:</span> ${rule.response}</div>
                            <div><span class="font-medium">Number:</span> ${rule.number || 'Semua nomor'}</div>
                            <div><span class="font-medium">Status:</span> ${rule.active ? 'Aktif' : 'Nonaktif'}</div>
                        </div>
                    </div>
                    
                    <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div class="flex items-start">
                            <i class="fas fa-info-circle text-amber-500 mt-0.5 mr-2"></i>
                            <div class="text-sm text-amber-800">
                                <strong>Testing Mode:</strong> Ini hanya simulasi. Rule akan di-test terhadap pesan dummy.
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex space-x-2">
                        <button onclick="performRuleTest('${rule.id}')" 
                                class="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white py-2 px-4 rounded-lg transition-all duration-200 shadow hover:shadow-lg flex items-center justify-center">
                            <i class="fas fa-play mr-2"></i>
                            Jalankan Test
                        </button>
                        <button onclick="closeTestModal()" 
                                class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center">
                            Batal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('testRuleModal');
    if (existingModal) existingModal.remove();
    
    // Add new modal
    const modalContainer = document.createElement('div');
    modalContainer.id = 'testRuleModal';
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
}

function closeTestModal() {
    const modal = document.getElementById('testRuleModal');
    if (modal) modal.remove();
}

function performRuleTest(ruleId) {
    const rule = currentData.replyRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    addStatusLog(`🧪 Testing rule: "${rule.keyword}"`);
    
    // Simulate test scenarios
    const testMessages = [
        `Ini adalah pesan test dengan keyword "${rule.keyword}"`,
        `Halo, saya ingin info tentang "${rule.keyword}"`,
        `Apakah "${rule.keyword}" tersedia?`
    ];
    
    let matchFound = false;
    
    for (const testMessage of testMessages) {
        if (testMessage.toLowerCase().includes(rule.keyword.toLowerCase())) {
            matchFound = true;
            addStatusLog(`✅ Test PASS: "${testMessage}" → "${rule.response}"`);
            break;
        }
    }
    
    if (!matchFound) {
        addStatusLog(`❌ Test FAIL: Tidak ada pesan test yang match dengan keyword "${rule.keyword}"`);
    }
    
    closeTestModal();
    showNotification('Test rule selesai - lihat log untuk hasil', 'info');
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

function saveReplyRulesCSV() {
    if (currentData.replyRules.length === 0) {
        showNotification('Tidak ada rules untuk disimpan', 'warning');
        return;
    }
    
    try {
        // Create CSV header
        let csvContent = 'Number,Keyword,Response,Active\n';
        
        // Add rules data
        currentData.replyRules.forEach(rule => {
            const row = [
                rule.number || '',
                `"${rule.keyword.replace(/"/g, '""')}"`,
                `"${rule.response.replace(/"/g, '""')}"`,
                rule.active ? 'Yes' : 'No'
            ].join(',');
            csvContent += row + '\n';
        });
        
        // Download CSV
        const timestamp = new Date().toISOString().split('T')[0];
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `whatsapp-reply-rules-${timestamp}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        addStatusLog('📤 Rules berhasil diexport ke CSV');
        showNotification('Rules berhasil diexport ke CSV', 'success');
        
    } catch (error) {
        addStatusLog('❌ Gagal export rules: ' + error.message);
        showNotification('Gagal export rules', 'error');
    }
}

function importReplyRules() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                let importedRules = [];
                
                if (file.name.endsWith('.csv')) {
                    importedRules = parseCSVRules(content);
                } else if (file.name.endsWith('.json')) {
                    const importData = JSON.parse(content);
                    importedRules = importData.rules || [];
                }
                
                if (importedRules.length === 0) {
                    throw new Error('Tidak ada rules yang valid ditemukan');
                }
                
                // Add imported rules
                const newRules = importedRules.map(rule => ({
                    ...rule,
                    id: generateRuleId()
                }));
                
                currentData.replyRules.push(...newRules);
                saveAutoReplyData();
                displayReplyRulesTable(currentData.replyRules);
                
                addStatusLog(`✅ ${newRules.length} rules berhasil diimport`);
                showNotification(`${newRules.length} rules berhasil diimport`, 'success');
                
            } catch (error) {
                addStatusLog('❌ Gagal import rules: ' + error.message);
                showNotification('Gagal import rules', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function parseCSVRules(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const rules = [];
    const headers = lines[0].split(',').map(h => h.trim());
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rule = {
            number: values[0] || '',
            keyword: values[1] || '',
            response: values[2] || '',
            active: values[3]?.toLowerCase() === 'yes' || values[3]?.toLowerCase() === 'true'
        };
        
        if (rule.keyword && rule.response) {
            rules.push(rule);
        }
    }
    
    return rules;
}

function clearAllRules() {
    if (currentData.replyRules.length === 0) {
        showNotification('Tidak ada rules untuk dihapus', 'info');
        return;
    }
    
    if (!confirm(`Apakah Anda yakin ingin menghapus semua ${currentData.replyRules.length} rules?`)) return;
    
    currentData.replyRules = [];
    saveAutoReplyData();
    displayReplyRulesTable(currentData.replyRules);
    
    addStatusLog('🗑️ Semua rules berhasil dihapus');
    showNotification('Semua rules berhasil dihapus', 'success');
}

// ============================================================================
// MESSAGE LOG MANAGEMENT
// ============================================================================

function loadMessageLog() {
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

function clearMessageLog() {
    if (currentData.messageLog.length === 0) {
        showNotification('Tidak ada log untuk dihapus', 'info');
        return;
    }
    
    if (confirm('Apakah Anda yakin ingin menghapus semua log pesan?')) {
        currentData.messageLog = [];
        saveAutoReplyData();
        displayMessageLog();
        addStatusLog('🗑️ Semua log pesan dihapus');
        showNotification('Log pesan berhasil dihapus', 'success');
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateRuleId() {
    return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeReplyTab() {
    loadReplySettings();
    loadReplyRules();
    loadMessageLog();
}

// ============================================================================
// EXPORT FUNCTIONS TO WINDOW OBJECT
// ============================================================================

window.saveReplySettings = saveReplySettings;
window.loadReplySettings = loadReplySettings;
window.addNewRule = addNewRule;
window.editRule = editRule;
window.deleteRule = deleteRule;
window.toggleRuleStatus = toggleRuleStatus;
window.testRule = testRule;
window.saveRule = saveRule;
window.closeEditModal = closeEditModal;
window.closeTestModal = closeTestModal;
window.performRuleTest = performRuleTest;
window.saveReplyRulesCSV = saveReplyRulesCSV;
window.importReplyRules = importReplyRules;
window.clearAllRules = clearAllRules;
window.loadReplyRules = loadReplyRules;
window.loadMessageLog = loadMessageLog;
window.clearMessageLog = clearMessageLog;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize when reply tab is activated
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const replyContent = document.getElementById('replyContent');
                if (replyContent && !replyContent.classList.contains('hidden')) {
                    initializeReplyTab();
                }
            }
        });
    });
    
    const replyContent = document.getElementById('replyContent');
    if (replyContent) {
        observer.observe(replyContent, { attributes: true });
    }
});

console.log('✅ WhatsApp Blaze reply functions dengan start/stop system loaded successfully');