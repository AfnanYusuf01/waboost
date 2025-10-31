// Login System for WhatsApp Blaze - PRODUCTION ONLY (FIXED + SECURITY)
class LoginSystem {
    constructor() {
        // API Configuration - PRODUCTION
        this.apiUrl = "https://api2.solvy.cloud/waboost/check";
        this.apiKey = "c83c86ec-ca8e-456f-9cd7-f67e4cf469a2";
        
        // Session Configuration
        this.sessionDuration = 60 * 60 * 1000; // 1 hour
        this.maxRetryAttempts = 3;
        this.retryDelay = 2000;
        
        this.init();
    }

    init() {
        this.setupSecurityProtection(); // 🔒 ADDED SECURITY
        this.setupEventListeners();
        this.checkExistingSession();
        this.setupNotificationStyles();
    }

    // 🔒 ADDED SECURITY PROTECTION METHODS
    setupSecurityProtection() {
        this.preventDeveloperTools();
        this.disableRightClick();
        this.disableKeyboardShortcuts();
        this.detectDevTools();
    }

    preventDeveloperTools() {
        // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
        document.addEventListener('keydown', (e) => {
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.shiftKey && e.key === 'J') ||
                (e.ctrlKey && e.shiftKey && e.key === 'C') ||
                (e.ctrlKey && e.key === 'u')
            ) {
                e.preventDefault();
                this.showSecurityWarning();
                return false;
            }
        });

        // Prevent right-click context menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showSecurityWarning();
            return false;
        });
    }

    disableRightClick() {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Prevent drag and drop
        document.addEventListener('dragstart', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }

    disableKeyboardShortcuts() {
        const disabledKeys = [
            'F12', 'I', 'J', 'C', 'U'
        ];

        document.addEventListener('keydown', (e) => {
            if (
                (e.ctrlKey && disabledKeys.includes(e.key)) ||
                (e.ctrlKey && e.shiftKey && disabledKeys.includes(e.key)) ||
                e.key === 'F12'
            ) {
                e.preventDefault();
                e.stopPropagation();
                this.showSecurityWarning();
                return false;
            }
        });
    }

    detectDevTools() {
        // Detect DevTools opening via debugger statement
        const checkDevTools = () => {
            const start = Date.now();
            debugger; // This will pause if DevTools is open
            const end = Date.now();
            if (end - start > 100) {
                this.handleDevToolsDetected();
            }
        };

        // Run check periodically
        setInterval(checkDevTools, 1000);

        // Also check on resize (DevTools often changes window size)
        let lastWidth = window.innerWidth;
        window.addEventListener('resize', () => {
            if (window.innerWidth !== lastWidth) {
                setTimeout(checkDevTools, 100);
            }
            lastWidth = window.innerWidth;
        });
    }

    handleDevToolsDetected() {
        console.log('Developer Tools detected!');
        this.showSecurityWarning();
        
        // Optional: Redirect or disable functionality
        // document.body.innerHTML = '<h1>Access Denied - Developer Tools Detected</h1>';
        // window.location.href = 'about:blank';
    }

    showSecurityWarning() {
        this.showNotification('Akses developer tools diblokir untuk keamanan', 'warning');
        
        // Optional: More aggressive measures
        // for (let i = 0; i < 10; i++) {
        //     console.log('⚠️ Developer Tools Detected - Access Blocked ⚠️');
        // }
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const licenseInput = document.getElementById('licenseKey');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
        
        if (licenseInput) {
            licenseInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleLogin();
                }
            });
            
            // Clean input - remove spaces and convert to uppercase
            licenseInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\s/g, '').toUpperCase();
            });

            // Paste event handler
            licenseInput.addEventListener('paste', (e) => {
                setTimeout(() => {
                    e.target.value = e.target.value.replace(/\s/g, '').toUpperCase();
                }, 10);
            });
        }
    }

    setupNotificationStyles() {
        if (!document.getElementById('notificationStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationStyles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 16px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    transform: translateX(400px);
                    opacity: 0;
                    transition: all 0.3s ease-in-out;
                    z-index: 10000;
                    min-width: 300px;
                    max-width: 400px;
                }
                
                .notification.show {
                    transform: translateX(0);
                    opacity: 1;
                }
                
                .notification.success {
                    background: linear-gradient(135deg, #10b981, #059669);
                    border-left: 4px solid #047857;
                }
                
                .notification.error {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    border-left: 4px solid #b91c1c;
                }
                
                .notification.warning {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    border-left: 4px solid #b45309;
                }
                
                .notification.info {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    border-left: 4px solid #1d4ed8;
                }
                
                .notification button {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }
                
                .notification button:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .btn-loading {
                    position: relative;
                    color: transparent !important;
                }

                .btn-loading::after {
                    content: '';
                    position: absolute;
                    width: 20px;
                    height: 20px;
                    top: 50%;
                    left: 50%;
                    margin-left: -10px;
                    margin-top: -10px;
                    border: 2px solid #ffffff;
                    border-radius: 50%;
                    border-top-color: transparent;
                    animation: spin 1s ease-in-out infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Security Warning Styles */
                .security-warning {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    border-left: 4px solid #b45309;
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 10001;
                    padding: 20px;
                    border-radius: 8px;
                    text-align: center;
                    min-width: 300px;
                }
            `;
            document.head.appendChild(style);
        }
    }

    async checkExistingSession() {
        try {
            const session = this.validateSession();
            if (session.isValid) {
                // this.showQuickLoginOption(session.remainingMinutes);
                this.prefillLicenseField();
                console.log('Session valid, remaining:', session.remainingMinutes + ' minutes');
            } else if (session.license) {
                // Session expired but license exists
                this.prefillLicenseField();
                this.showNotification('Session telah expired, silakan login kembali', 'warning');
                console.log('Session expired, license exists');
            } else {
                console.log('No valid session found');
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    validateSession() {
        const license = localStorage.getItem('whatsappBlaze_license');
        const pcid = localStorage.getItem('whatsappBlaze_pcid');
        const loginTime = localStorage.getItem('whatsappBlaze_loginTime');
        
        if (!license || !pcid || !loginTime) {
            return { isValid: false };
        }
        
        const loginTimestamp = parseInt(loginTime);
        const currentTime = Date.now();
        const sessionValid = (currentTime - loginTimestamp) <= this.sessionDuration;
        const remainingTime = Math.max(0, this.sessionDuration - (currentTime - loginTimestamp));
        const remainingMinutes = Math.ceil(remainingTime / (60 * 1000));
        
        return {
            isValid: sessionValid,
            remainingTime: remainingTime,
            remainingMinutes: remainingMinutes,
            license: license,
            pcid: pcid
        };
    }

    async handleLogin() {
        const licenseKey = document.getElementById('licenseKey').value.trim();
        
        if (!licenseKey) {
            this.showNotification('License key tidak boleh kosong', 'error');
            return;
        }

        // Basic license key validation
        if (licenseKey.length < 5) {
            this.showNotification('License key terlalu pendek', 'error');
            return;
        }
        
        const submitBtn = document.querySelector('#loginForm button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        this.setButtonLoading(submitBtn, true);

        try {
            const pcid = await this.generateDeviceId();
            console.log('Sending request with:', { licenseKey, pcid });
            
            const result = await this.validateLicense(licenseKey, pcid);
            
            if (result.success) {
                await this.saveLoginSession(licenseKey, pcid);
                this.showNotification('Login berhasil! Mengarahkan...', 'success');
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                this.showNotification(result.error, 'error');
                // Clear invalid session for specific error codes
                if (result.clearSession) {
                    this.clearSession();
                }
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Terjadi kesalahan: ' + error.message, 'error');
        } finally {
            this.setButtonLoading(submitBtn, false, originalText);
        }
    }

    async validateLicense(licenseKey, pcid) {
        for (let attempt = 1; attempt <= this.maxRetryAttempts; attempt++) {
            try {
                console.log(`Validation attempt ${attempt} for license: ${licenseKey}`);
                const result = await this.callLicenseAPI(licenseKey, pcid);
                
                console.log('API Response received:', result);
                
                // FIXED: Hanya check status true/false, tidak perlu check code
                if (result.status === true) {
                    console.log('Login SUCCESS - License valid');
                    return { 
                        success: true, 
                        data: result 
                    };
                } 
                // Handle failed attempts with specific error codes
                else if (result.status === false) {
                    console.log('Login FAILED - License invalid, code:', result.code);
                    return { 
                        success: false, 
                        error: this.getErrorMessage(result.code, result.message),
                        clearSession: this.shouldClearSession(result.code)
                    };
                }
                // Handle unexpected response format
                else {
                    console.log('UNEXPECTED response format:', result);
                    return { 
                        success: false, 
                        error: 'Format response tidak valid dari server',
                        clearSession: false
                    };
                }
                
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error);
                
                if (attempt < this.maxRetryAttempts) {
                    console.log(`Retrying in ${this.retryDelay}ms...`);
                    await this.delay(this.retryDelay);
                } else {
                    console.log('All attempts failed');
                    return { 
                        success: false, 
                        error: 'Gagal terhubung ke server license. Periksa koneksi internet Anda.',
                        clearSession: false
                    };
                }
            }
        }
    }

    async callLicenseAPI(licenseKey, pcid) {
        const formData = new URLSearchParams();
        formData.append('key', licenseKey);
        formData.append('pcid', pcid);
        formData.append('apikey', this.apiKey);

        console.log('Sending API request to:', this.apiUrl);
        console.log('Request data:', {
            key: licenseKey,
            pcid: pcid,
            apikey: '***' + this.apiKey.slice(-4) // Mask API key in logs
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('Response status:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('API Response data:', data);
            return data;

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Timeout: Server tidak merespons dalam 15 detik');
            }
            
            throw new Error(`Network error: ${error.message}`);
        }
    }

    getErrorMessage(errorCode, apiMessage) {
        const messages = {
            0: 'License tidak ditemukan atau tidak valid',
            1: 'Data license tidak lengkap',
            2: 'License sudah expired',
            3: 'Login berhasil', // Should not be used as error
            4: 'Data yang dikirim tidak lengkap',
            5: 'License sudah terdaftar di device lain',
            'default': apiMessage || 'Terjadi kesalahan yang tidak diketahui'
        };
        
        return messages[errorCode] || messages['default'];
    }

    shouldClearSession(errorCode) {
        // Clear session for these error codes
        const clearSessionCodes = [0, 2, 5]; // Not found, expired, registered to other device
        return clearSessionCodes.includes(errorCode);
    }

    async generateDeviceId() {
        try {
            // Get existing device ID or create new one
            let deviceId = localStorage.getItem('whatsappBlaze_deviceId');
            
            if (!deviceId) {
                const components = [
                    navigator.userAgent,
                    navigator.platform,
                    navigator.hardwareConcurrency?.toString() || 'unknown',
                    `${screen.width}x${screen.height}`,
                    navigator.language,
                    new Date().getTimezoneOffset().toString(),
                    navigator.deviceMemory?.toString() || 'unknown',
                    navigator.maxTouchPoints?.toString() || 'unknown'
                ].join('|');

                // Simple hash function
                let hash = 0;
                for (let i = 0; i < components.length; i++) {
                    const char = components.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }

                const timestamp = Date.now().toString(36);
                const randomStr = Math.random().toString(36).substring(2, 10);
                deviceId = `blz_${Math.abs(hash).toString(36)}_${timestamp}_${randomStr}`;
                
                // Store for future use
                localStorage.setItem('whatsappBlaze_deviceId', deviceId);
                console.log('Generated new device ID:', deviceId);
            } else {
                console.log('Using existing device ID:', deviceId);
            }
            
            return deviceId.substring(0, 100);
            
        } catch (error) {
            console.error('Device ID generation error:', error);
            // Fallback device ID
            const fallbackId = `blz_fallback_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
            console.log('Using fallback device ID:', fallbackId);
            return fallbackId;
        }
    }

    async saveLoginSession(licenseKey, pcid) {
        const loginTime = Date.now();
        const expiredTime = loginTime + this.sessionDuration;
        
        localStorage.setItem('whatsappBlaze_license', licenseKey);
        localStorage.setItem('whatsappBlaze_pcid', pcid);
        localStorage.setItem('whatsappBlaze_loginTime', loginTime.toString());
        localStorage.setItem('whatsappBlaze_expiredTime', expiredTime.toString());
        
        console.log('Session saved:', { 
            licenseKey: licenseKey, 
            pcid: pcid, 
            loginTime: new Date(loginTime).toISOString(),
            expiredTime: new Date(expiredTime).toISOString()
        });
    }

    clearSession() {
        // MODIFIED: Hanya hapus data session, JANGAN hapus PCID/deviceId
        localStorage.removeItem('whatsappBlaze_license');
        // localStorage.removeItem('whatsappBlaze_pcid'); // ❌ JANGAN DIHAPUS (PCID tetap disimpan)
        localStorage.removeItem('whatsappBlaze_loginTime');
        localStorage.removeItem('whatsappBlaze_expiredTime');
        
        console.log('Session cleared (PCID preserved)');
    }

    // showQuickLoginOption(remainingMinutes) {
    //     // Remove existing quick login button if any
    //     const existingBtn = document.querySelector('.quick-login-btn');
    //     if (existingBtn) {
    //         existingBtn.remove();
    //     }
        
    //     const quickLoginBtn = document.createElement('button');
    //     quickLoginBtn.type = 'button';
    //     quickLoginBtn.className = 'quick-login-btn w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 mb-3 flex items-center justify-center';
    //     quickLoginBtn.innerHTML = `
    //     `;
        
    //     quickLoginBtn.onclick = () => {
    //         console.log('Quick login activated');
    //         this.showNotification('Quick login berhasil!', 'success');
    //         setTimeout(() => {
    //             window.location.href = 'index.html';
    //         }, 500);
    //     };
        
    //     const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    //     if (submitBtn && submitBtn.parentNode) {
    //         submitBtn.parentNode.insertBefore(quickLoginBtn, submitBtn);
    //     }
    // }

    prefillLicenseField() {
        const license = localStorage.getItem('whatsappBlaze_license');
        const licenseInput = document.getElementById('licenseKey');
        
        if (license && licenseInput) {
            licenseInput.value = license;
            console.log('Prefilled license field');
        }
    }

    setButtonLoading(button, isLoading, originalText = 'Launch Waboost') {
        if (isLoading) {
            button.innerHTML = 'Validating...';
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.innerHTML = originalText;
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showNotification(message, type = 'info') {
        // Create notification container if it doesn't exist
        let notificationContainer = document.getElementById('notificationContainer');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notificationContainer';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 0;
                right: 0;
                z-index: 10000;
                padding: 20px;
                max-width: 400px;
            `;
            document.body.appendChild(notificationContainer);
        }
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fas ${icons[type]} mr-3"></i>
                    <span class="font-medium">${message}</span>
                </div>
                <button class="ml-4 text-white hover:text-gray-200 transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add close functionality
        const closeBtn = notification.querySelector('button');
        closeBtn.onclick = () => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        };
        
        notificationContainer.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }

    logout() {
        if (confirm('Apakah Anda yakin ingin logout?')) {
            console.log('User initiated logout');
            this.clearSession();
            window.location.href = 'login.html';
        }
    }

    // Utility method to check if user is logged in
    isLoggedIn() {
        return this.validateSession().isValid;
    }

    // Method to get remaining session time
    getRemainingSessionTime() {
        const session = this.validateSession();
        if (session.isValid) {
            return session.remainingTime;
        }
        return 0;
    }
}

// Initialize Login System when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Login System...');
    window.loginSystem = new LoginSystem();
    
    // Add global logout function
    window.logout = () => {
        window.loginSystem.logout();
    };
    
    // Add global login check function
    window.isLoggedIn = () => {
        return window.loginSystem.isLoggedIn();
    };

    console.log('Login System initialized successfully');
});

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginSystem;
}