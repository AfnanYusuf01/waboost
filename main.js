const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let accountWindows = new Map();

// GUNAKAN APP USER DATA DIRECTORY - PALING AMAN
const getDataDirectories = () => {
    const userDataPath = app.getPath('userData');
    return {
        accountsDir: path.join(userDataPath, 'accounts'),
        exportsDir: path.join(userDataPath, 'exports'),
        basePath: userDataPath
    };
};

let dataDirs = getDataDirectories();

// ============================================================================
// FUNGSI YANG LEBIH ROBUST
// ============================================================================

function ensureDirectories() {
    try {
        console.log('📁 Initializing directories...');
        console.log('Base path:', dataDirs.basePath);
        console.log('Accounts dir:', dataDirs.accountsDir);
        console.log('Exports dir:', dataDirs.exportsDir);

        // Pastikan base directory ada
        if (!fs.existsSync(dataDirs.basePath)) {
            fs.mkdirSync(dataDirs.basePath, { recursive: true });
        }

        // Buat subdirectories
        [dataDirs.accountsDir, dataDirs.exportsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log('✅ Created directory:', dir);
            }
        });

        // Test write permission
        const testFile = path.join(dataDirs.accountsDir, 'test-write.tmp');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);

        console.log('✅ All directories initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Error initializing directories:', error);
        return false;
    }
}

function readJsonSync(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading JSON file:', error);
        return null;
    }
}

function writeJsonSync(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log('✅ File written successfully:', filePath);
        return true;
    } catch (error) {
        console.error('❌ Error writing file:', error);
        console.error('File path:', filePath);
        return false;
    }
}

function removeSync(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('✅ File removed successfully:', filePath);
            return true;
        }
        return true;
    } catch (error) {
        console.error('Error removing file:', error);
        return false;
    }
}

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false
        },
        icon: path.join(__dirname, 'src/assets/icons/icon.png'),
        title: 'Waboost - Account Management',
        show: false
    });

    mainWindow.loadFile('src/login.html');
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

function createAccountWindow(accountId) {
    if (accountWindows.has(accountId)) {
        accountWindows.get(accountId).focus();
        return;
    }

    const accountWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-webview.js'),
            webSecurity: false,
            allowRunningInsecureContent: true,
            webviewTag: true,
            plugins: true,
            partition: `persist:whatsapp-${accountId}`
        },
        icon: path.join(__dirname, 'src/assets/icons/icon.png'),
        title: `Waboost - ${accountId}`,
        show: false
    });

    accountWindow.loadFile('src/account.html', { query: { accountId } });

    accountWindow.once('ready-to-show', () => {
        accountWindow.show();
    });

    accountWindow.on('closed', () => {
        accountWindows.delete(accountId);
    });

    accountWindows.set(accountId, accountWindow);

    if (process.argv.includes('--dev')) {
        accountWindow.webContents.openDevTools();
    }
}

// ============================================================================
// IPC HANDLERS - DIPERBAIKI
// ============================================================================

// Account Management Handlers
ipcMain.handle('get-accounts', async () => {
    try {
        if (!ensureDirectories()) {
            return [];
        }

        if (!fs.existsSync(dataDirs.accountsDir)) {
            return [];
        }

        const files = fs.readdirSync(dataDirs.accountsDir);
        const accounts = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                try {
                    const filePath = path.join(dataDirs.accountsDir, file);
                    const accountData = readJsonSync(filePath);
                    if (!accountData) return null;
                    
                    return {
                        id: path.basename(file, '.json'),
                        ...accountData
                    };
                } catch (error) {
                    console.error(`Error reading account file ${file}:`, error);
                    return null;
                }
            })
            .filter(account => account !== null);

        console.log(`📊 Found ${accounts.length} accounts`);
        return accounts;
    } catch (error) {
        console.error('Error in get-accounts:', error);
        return [];
    }
});

ipcMain.handle('save-account', async (event, accountData) => {
    try {
        if (!ensureDirectories()) {
            return { success: false, error: 'Cannot create directories' };
        }

        const accountId = accountData.id || `account_${Date.now()}`;
        const accountPath = path.join(dataDirs.accountsDir, `${accountId}.json`);
        
        // Validate account data
        if (!accountData.name || accountData.name.trim() === '') {
            return { success: false, error: 'Account name is required' };
        }

        const accountToSave = {
            id: accountId,
            name: accountData.name.trim(),
            createdAt: accountData.createdAt || new Date().toISOString(),
            status: accountData.status || 'active',
            lastModified: new Date().toISOString()
        };

        const success = writeJsonSync(accountPath, accountToSave);
        if (success) {
            console.log('✅ Account saved successfully:', accountId);
            return { success: true, accountId };
        } else {
            return { success: false, error: 'Failed to write account file' };
        }
    } catch (error) {
        console.error('Error in save-account:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-account', async (event, accountId) => {
    try {
        if (!ensureDirectories()) {
            return { success: false, error: 'Cannot access directories' };
        }
        
        const accountPath = path.join(dataDirs.accountsDir, `${accountId}.json`);
        
        if (!fs.existsSync(accountPath)) {
            return { success: false, error: 'Account not found' };
        }

        const success = removeSync(accountPath);
        if (success) {
            console.log('✅ Account deleted successfully:', accountId);
            return { success: true };
        } else {
            return { success: false, error: 'Failed to delete account file' };
        }
    } catch (error) {
        console.error('Error in delete-account:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-account', (event, accountId) => {
    try {
        createAccountWindow(accountId);
        return { success: true };
    } catch (error) {
        console.error('Error in open-account:', error);
        return { success: false, error: error.message };
    }
});

// Export data handlers
ipcMain.handle('save-export-data', async (event, { filename, data }) => {
    try {
        if (!ensureDirectories()) {
            return { success: false, error: 'Cannot create directories' };
        }
        
        if (!filename || !filename.endsWith('.json')) {
            filename = `${filename || 'export'}.json`;
        }
        
        const exportPath = path.join(dataDirs.exportsDir, filename);
        
        const success = writeJsonSync(exportPath, data);
        if (success) {
            return { success: true, path: exportPath };
        } else {
            return { success: false, error: 'Failed to write export file' };
        }
    } catch (error) {
        console.error('Error in save-export-data:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, options);
        return result;
    } catch (error) {
        console.error('Error in show-save-dialog:', error);
        return { canceled: true, error: error.message };
    }
});

// WebView Management
ipcMain.handle('reload-webview', async (event, accountId) => {
    try {
        const accountWindow = accountWindows.get(accountId);
        if (accountWindow) {
            accountWindow.reload();
            return { success: true };
        }
        return { success: false, error: 'Window not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-webview-url', async (event, accountId) => {
    try {
        const accountWindow = accountWindows.get(accountId);
        if (accountWindow) {
            const url = accountWindow.webContents.getURL();
            return { success: true, url };
        }
        return { success: false, error: 'Window not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================================================================
// APP EVENT HANDLERS
// ============================================================================

app.whenReady().then(() => {
    console.log('🚀 Waboost starting...');
    ensureDirectories();
    createMainWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('✅ Waboost main process initialized successfully');