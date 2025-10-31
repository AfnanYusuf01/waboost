// Account Management Functions dengan Authentication System dan Window Management

// ============================================================================
// AUTHENTICATION SYSTEM
// ============================================================================

function checkAuth() {
    const isTestMode = localStorage.getItem('whatsappBlaze_testMode') === 'true';
    const hasLicense = localStorage.getItem('whatsappBlaze_license');
    
    if (!isTestMode && !hasLicense) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function setupLicenseInfo() {
    const licenseInfo = document.getElementById('licenseInfo');
    const licenseType = document.getElementById('licenseType');
    const testModeBadge = document.getElementById('testModeBadge');
    
    const isTestMode = localStorage.getItem('whatsappBlaze_testMode') === 'true';
    const licenseKey = localStorage.getItem('whatsappBlaze_license');
    
    if (isTestMode) {
        licenseType.textContent = 'Test Mode';
        testModeBadge.classList.remove('hidden');
        licenseInfo.classList.remove('hidden');
    } else if (licenseKey) {
        // Tampilkan sebagian license key untuk keamanan
        const maskedLicense = licenseKey.substring(0, 8) + '***' + licenseKey.substring(licenseKey.length - 4);
        licenseType.textContent = `License: ${maskedLicense}`;
        testModeBadge.classList.add('hidden');
        licenseInfo.classList.remove('hidden');
    } else {
        licenseInfo.classList.add('hidden');
    }
}

async function logout() {
    if (confirm('Apakah Anda yakin ingin logout? Semua window akun WhatsApp akan ditutup.')) {
        try {
            // Show loading state
            showNotification('Menutup semua window...', 'info');
            
            // Clear all auth data
            localStorage.removeItem('whatsappBlaze_license');
            localStorage.removeItem('whatsappBlaze_pcid');
            localStorage.removeItem('whatsappBlaze_testMode');
            
            // Tutup semua window account yang terbuka
            await closeAllAccountWindows();
            
            // Tunggu sebentar sebelum redirect
            setTimeout(() => {
                showNotification('Logout berhasil', 'success');
                
                // Redirect to login page dalam window yang sama
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
            }, 500);
            
        } catch (error) {
            console.error('Logout error:', error);
            showError('Error saat logout: ' + error.message);
        }
    }
}

// ============================================================================
// WINDOW MANAGEMENT FUNCTIONS
// ============================================================================

async function closeAllAccountWindows() {
    return new Promise((resolve) => {
        try {
            // Jika ini adalah main window, coba tutup semua child windows
            if (!window.opener) {
                // Simpan reference ke semua window yang dibuka
                const openedWindows = window.whatsappBlazeOpenedWindows || [];
                
                // Tutup semua window yang tercatat
                openedWindows.forEach(winRef => {
                    try {
                        if (winRef && !winRef.closed) {
                            winRef.close();
                        }
                    } catch (e) {
                        console.log('Tidak bisa menutup window:', e);
                    }
                });
                
                // Clear the tracking array
                window.whatsappBlazeOpenedWindows = [];
            }
            
            // Jika ini adalah child window (account window), tutup diri sendiri
            if (window.opener) {
                window.close();
            }
            
            resolve();
        } catch (error) {
            console.error('Error closing windows:', error);
            resolve(); // Tetap resolve meski ada error
        }
    });
}

function trackOpenedWindow(win) {
    // Initialize tracking array jika belum ada
    if (!window.whatsappBlazeOpenedWindows) {
        window.whatsappBlazeOpenedWindows = [];
    }
    
    // Tambahkan window ke tracking array
    window.whatsappBlazeOpenedWindows.push(win);
    
    // Setup event listener untuk remove window ketika ditutup
    win.addEventListener('beforeunload', () => {
        removeTrackedWindow(win);
    });
}

function removeTrackedWindow(win) {
    if (window.whatsappBlazeOpenedWindows) {
        window.whatsappBlazeOpenedWindows = window.whatsappBlazeOpenedWindows.filter(
            w => w !== win
        );
    }
}

function openLoginWindow() {
    // Buka window login baru
    const loginWindow = window.open('login.html', 'WhatsApp Blaze Login', 
        'width=400,height=500,menubar=no,toolbar=no,location=no,status=no');
    
    if (loginWindow) {
        showInfo('Window login dibuka di jendela baru');
        
        // Focus ke window login
        loginWindow.focus();
    } else {
        showError('Tidak dapat membuka window login. Izinkan popup untuk melanjutkan.');
    }
}

function closeCurrentWindow() {
    // Tutup window saat ini (untuk login window)
    if (window.opener) {
        // Jika ini adalah child window, tutup saja
        window.close();
    }
}

function refreshMainWindow() {
    // Refresh main window dari child window
    if (window.opener && !window.opener.closed) {
        window.opener.location.reload();
    }
}

// ============================================================================
// ACCOUNT MANAGEMENT FUNCTIONS
// ============================================================================

async function loadAccounts() {
    try {
        // Check authentication first
        if (!checkAuth()) return;
        
        const accounts = await window.electronAPI.getAccounts();
        const accountsGrid = document.getElementById('accountsGrid');
        const emptyState = document.getElementById('emptyState');

        if (accounts.length === 0) {
            accountsGrid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        accountsGrid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        accountsGrid.innerHTML = accounts.map(account => `
            <div class="account-card bg-white rounded-xl shadow-md border-0 p-6">
                <div class="flex items-center justify-between mb-5">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center mr-3">
                            <i class="fas fa-whatsapp text-blue-600"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-gray-800">${account.name || 'Unnamed Account'}</h3>
                            <p class="text-xs text-gray-500 mt-1">ID: ${account.id}</p>
                            ${account.createdAt ? `<p class="text-xs text-gray-400 mt-1">Dibuat: ${new Date(account.createdAt).toLocaleDateString('id-ID')}</p>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <i class="fas fa-circle text-xs mr-1"></i>
                            Active
                        </span>
                    </div>
                </div>
                
                <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div class="flex justify-between text-xs text-gray-600">
                        <span>Status:</span>
                        <span class="font-medium">Ready</span>
                    </div>
                </div>
                
                <div class="flex justify-between items-center pt-4 border-t border-gray-100">
                    <button onclick="deleteAccount('${account.id}')" 
                            class="text-red-500 hover:text-red-700 transition-colors text-sm font-medium flex items-center group">
                        <i class="fas fa-trash-alt mr-2 group-hover:scale-110 transition-transform"></i>
                        Hapus
                    </button>
                    <button onclick="openAccount('${account.id}')" 
                            class="btn-primary text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center group">
                        <i class="fas fa-external-link-alt mr-2 group-hover:scale-110 transition-transform"></i>
                        Buka Akun
                    </button>
                </div>
            </div>
        `).join('');
        
        // Update account count in license info
        updateAccountCount(accounts.length);
        
    } catch (error) {
        console.error('Error loading accounts:', error);
        showError('Gagal memuat akun: ' + error.message);
    }
}

function updateAccountCount(count) {
    const licenseType = document.getElementById('licenseType');
    const currentText = licenseType.textContent;
    
    // Check if we're already showing account count
    if (!currentText.includes('Akun:')) {
        licenseType.textContent = `${currentText} | Akun: ${count}`;
    }
}

async function openAccount(accountId) {
    try {
        // Show loading state
        const accountButtons = document.querySelectorAll(`[onclick="openAccount('${accountId}')"]`);
        accountButtons.forEach(btn => {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Membuka...';
            btn.disabled = true;
            
            // Restore after 2 seconds if something goes wrong
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }, 2000);
        });
        
        const result = await window.electronAPI.openAccount(accountId);
        if (!result.success) {
            showError('Gagal membuka akun: ' + result.error);
            
            // Restore buttons
            accountButtons.forEach(btn => {
                btn.innerHTML = '<i class="fas fa-external-link-alt mr-2"></i>Buka Akun';
                btn.disabled = false;
            });
        } else {
            showSuccess('Membuka window akun baru...');
            
            // Track the opened window jika menggunakan window.open
            if (result.window) {
                trackOpenedWindow(result.window);
            }
        }
    } catch (error) {
        console.error('Error opening account:', error);
        showError('Error membuka akun: ' + error.message);
        
        // Restore buttons
        const accountButtons = document.querySelectorAll(`[onclick="openAccount('${accountId}')"]`);
        accountButtons.forEach(btn => {
            btn.innerHTML = '<i class="fas fa-external-link-alt mr-2"></i>Buka Akun';
            btn.disabled = false;
        });
    }
}

async function deleteAccount(accountId) {
    if (confirm('Apakah Anda yakin ingin menghapus akun ini? Semua data yang terkait akan dihapus permanen.')) {
        try {
            // Show loading state
            const deleteButtons = document.querySelectorAll(`[onclick="deleteAccount('${accountId}')"]`);
            deleteButtons.forEach(btn => {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Menghapus...';
                btn.disabled = true;
            });
            
            const result = await window.electronAPI.deleteAccount(accountId);
            if (result.success) {
                await loadAccounts();
                showSuccess('Akun berhasil dihapus');
            } else {
                showError('Gagal menghapus akun: ' + result.error);
                
                // Restore buttons
                deleteButtons.forEach(btn => {
                    btn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Hapus';
                    btn.disabled = false;
                });
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            showError('Error menghapus akun: ' + error.message);
            
            // Restore buttons
            const deleteButtons = document.querySelectorAll(`[onclick="deleteAccount('${accountId}')"]`);
            deleteButtons.forEach(btn => {
                btn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Hapus';
                btn.disabled = false;
            });
        }
    }
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function openAddAccountModal() {
    document.getElementById('addAccountModal').classList.remove('hidden');
    document.getElementById('accountName').focus();
    
    // Add animation
    setTimeout(() => {
        const modal = document.getElementById('addAccountModal');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
}

function closeAddAccountModal() {
    const modal = document.getElementById('addAccountModal');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('addAccountForm').reset();
    }, 200);
}

// ============================================================================
// FORM HANDLING
// ============================================================================

document.getElementById('addAccountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const accountName = document.getElementById('accountName').value.trim();
    if (!accountName) {
        showError('Nama akun tidak boleh kosong');
        return;
    }

    // Show loading state
    const submitBtn = document.querySelector('#addAccountForm button[type="submit"]');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Menyimpan...';
    submitBtn.disabled = true;

    try {
        const result = await window.electronAPI.saveAccount({
            name: accountName,
            createdAt: new Date().toISOString(),
            status: 'active',
            lastAccessed: new Date().toISOString()
        });

        if (result.success) {
            closeAddAccountModal();
            await loadAccounts();
            showSuccess('Akun berhasil dibuat: ' + accountName);
        } else {
            showError('Gagal menyimpan akun: ' + result.error);
        }
    } catch (error) {
        console.error('Error saving account:', error);
        showError('Error menyimpan akun: ' + error.message);
    } finally {
        // Restore button state
        submitBtn.innerHTML = originalHTML;
        submitBtn.disabled = false;
    }
});

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showWarning(message) {
    showNotification(message, 'warning');
}

function showInfo(message) {
    showNotification(message, 'info');
}

function showNotification(message, type = 'info') {
    const notificationContainer = document.getElementById('notificationContainer');
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Add icon based on type
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle mr-2"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle mr-2"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle mr-2"></i>';
            break;
        default:
            icon = '<i class="fas fa-info-circle mr-2"></i>';
    }
    
    notification.innerHTML = `
        <div class="flex items-center">
            ${icon}
            <span>${message}</span>
        </div>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Close modal when clicking outside
document.getElementById('addAccountModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeAddAccountModal();
    }
});

// Escape key to close modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAddAccountModal();
    }
});

// Handle window focus/blur events
window.addEventListener('focus', function() {
    // Refresh data ketika window mendapatkan focus kembali
    if (window.location.pathname.includes('index.html')) {
        loadAccounts();
    }
});

// Handle window beforeunload event
window.addEventListener('beforeunload', function() {
    // Jika ini adalah child window, beri tahu parent bahwa kita akan ditutup
    if (window.opener && typeof window.opener.removeTrackedWindow === 'function') {
        window.opener.removeTrackedWindow(window);
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!checkAuth()) return;
    
    // Setup license information
    setupLicenseInfo();
    
    // Load accounts
    loadAccounts();
    
    // Show welcome message based on mode
    const isTestMode = localStorage.getItem('whatsappBlaze_testMode') === 'true';
    if (isTestMode) {
        showWarning('Anda menggunakan TEST MODE - Fitur terbatas');
    } else {
        showSuccess('Login berhasil! Selamat menggunakan WhatsApp Blaze');
    }
    
    // Initialize window tracking array
    if (!window.whatsappBlazeOpenedWindows) {
        window.whatsappBlazeOpenedWindows = [];
    }
    
    // Log window info untuk debugging
    console.log('Window Info:', {
        isMainWindow: !window.opener,
        hasOpener: !!window.opener,
        location: window.location.href,
        trackedWindows: window.whatsappBlazeOpenedWindows?.length || 0
    });
});

// ============================================================================
// WINDOW EXPORTS
// ============================================================================

// Export functions for global access
window.logout = logout;
window.openAccount = openAccount;
window.deleteAccount = deleteAccount;
window.openAddAccountModal = openAddAccountModal;
window.closeAddAccountModal = closeAddAccountModal;
window.loadAccounts = loadAccounts;
window.openLoginWindow = openLoginWindow;
window.closeCurrentWindow = closeCurrentWindow;
window.refreshMainWindow = refreshMainWindow;
window.closeAllAccountWindows = closeAllAccountWindows;
window.trackOpenedWindow = trackOpenedWindow;
window.removeTrackedWindow = removeTrackedWindow;

// Export untuk diakses dari window lain
window.whatsappBlaze = {
    logout: logout,
    loadAccounts: loadAccounts,
    showNotification: showNotification,
    closeAllAccountWindows: closeAllAccountWindows
};

console.log('✅ WhatsApp Blaze Account Manager loaded successfully');