const { app, BrowserWindow, ipcMain, dialog, Notification, safeStorage } = require('electron');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let updatePromptOpen = false;
let updateDownloadStarted = false;
let manualUpdateCheck = false;
const emailSettingsPath = () => path.join(app.getPath('userData'), 'email-settings.json');
function readEmailSettings() {
    try {
        const saved = JSON.parse(fs.readFileSync(emailSettingsPath(), 'utf8'));
        const password = saved.passwordEncrypted && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(saved.passwordEncrypted, 'base64')) : '';
        return { ...saved, password };
    } catch (_) { return {}; }
}
function writeEmailSettings(settings) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is not available on this computer.');
    const passwordEncrypted = settings.password ? safeStorage.encryptString(settings.password).toString('base64') : '';
    const stored = { fromEmail: String(settings.fromEmail || '').trim(), fromName: String(settings.fromName || 'Alfajar Travel UK').trim(), smtpHost: String(settings.smtpHost || '').trim(), smtpPort: Number(settings.smtpPort || 587), smtpSecure: Boolean(settings.smtpSecure), smtpUser: String(settings.smtpUser || '').trim(), passwordEncrypted };
    fs.writeFileSync(emailSettingsPath(), JSON.stringify(stored, null, 2), { mode: 0o600 });
    return { fromEmail: stored.fromEmail, configured: Boolean(stored.fromEmail && stored.smtpHost && stored.smtpUser && passwordEncrypted) };
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        minWidth: 900,
        minHeight: 650,
        title: 'Alfajar Travel Invoice Generator',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

async function checkForApplicationUpdates() {
    // Updates are available to installed builds only, not while running from source.
    if (!app.isPackaged) return;

    try {
        await autoUpdater.checkForUpdates();
    } catch (error) {
        console.error('Update check failed:', error);
    }
}

function configureAutoUpdates() {
    if (!app.isPackaged) return;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-not-available', async () => {
        if (manualUpdateCheck) {
            manualUpdateCheck = false;
            await dialog.showMessageBox(mainWindow, { type: 'info', title: 'No Updates Available', message: 'You are using the latest version of Alfajar Travel Invoice Generator.', buttons: ['OK'] });
        }
    });

    autoUpdater.on('update-available', async (info) => {
        manualUpdateCheck = false;
        if (updatePromptOpen || updateDownloadStarted) return;
        updatePromptOpen = true;

        const version = info.version || 'a newer version';
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Software Update Available',
            message: 'A new Alfajar Travel Invoice Generator update is available.',
            detail: 'Version ' + version + ' is ready to download. Your saved invoices will remain on this computer.',
            buttons: ['Download & Install', 'Later'],
            defaultId: 0,
            cancelId: 1,
            noLink: true
        });

        updatePromptOpen = false;

        if (result.response === 0) {
            updateDownloadStarted = true;
            try {
                await autoUpdater.downloadUpdate();
            } catch (error) {
                updateDownloadStarted = false;
                console.error('Update download failed:', error);
                await dialog.showMessageBox(mainWindow, {
                    type: 'error',
                    title: 'Update Download Failed',
                    message: 'The update could not be downloaded.',
                    detail: 'Please check your internet connection and try again later. ' + error.message,
                    buttons: ['OK']
                });
            }
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        const version = info.version || 'the latest version';

        // The user already chose Download & Install in the update popup.
        // Notify briefly, then install and restart automatically.
        if (Notification.isSupported()) {
            new Notification({
                title: 'Alfajar Travel updated',
                body: 'Version ' + version + ' is ready. The application is restarting now.'
            }).show();
        }

        setTimeout(() => autoUpdater.quitAndInstall(true, true), 1500);
    });

    autoUpdater.on('error', async (error) => {
        console.error('Auto-update error:', error);
        if (manualUpdateCheck) {
            manualUpdateCheck = false;
            await dialog.showMessageBox(mainWindow, { type: 'error', title: 'Update Check Failed', message: 'Could not check for updates. Please try again later.', detail: error.message, buttons: ['OK'] });
        }
    });
}

app.whenReady().then(() => {
    app.setAppUserModelId('uk.co.alfajartravel.invoicegenerator');
    createWindow();
    configureAutoUpdates();

    // Check shortly after the main window opens, then periodically while the app is running.
    setTimeout(checkForApplicationUpdates, 5000);
    setInterval(checkForApplicationUpdates, 6 * 60 * 60 * 1000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


ipcMain.handle('check-for-updates-manual', async () => {
    if (!app.isPackaged) return { message: 'Update checks are available in the installed application.' };
    manualUpdateCheck = true;
    try { await autoUpdater.checkForUpdates(); return { checking: true }; }
    catch (error) { manualUpdateCheck = false; throw new Error('Update check failed: ' + error.message); }
});

ipcMain.handle('get-email-settings', async () => {
    const s = readEmailSettings();
    return { fromEmail: s.fromEmail || '', fromName: s.fromName || 'Alfajar Travel UK', smtpHost: s.smtpHost || '', smtpPort: s.smtpPort || 587, smtpSecure: Boolean(s.smtpSecure), smtpUser: s.smtpUser || '', hasPassword: Boolean(s.password) };
});

ipcMain.handle('save-email-settings', async (_event, settings) => {
    if (!settings || !settings.fromEmail || !settings.smtpHost || !settings.smtpUser) throw new Error('Please enter the sender email, SMTP host and SMTP username.');
    const current = readEmailSettings();
    if (!settings.password && current.password) settings.password = current.password;
    if (!settings.password) throw new Error('Please enter the SMTP password or app password.');
    return writeEmailSettings(settings);
});

ipcMain.handle('send-invoice-email', async (event, payload) => {
    const settings = readEmailSettings();
    if (!settings.fromEmail || !settings.smtpHost || !settings.smtpUser || !settings.password) throw new Error('Please configure and save your Alfajar Travel email settings first.');
    if (!payload || !/^\S+@\S+\.\S+$/.test(String(payload.to || ''))) throw new Error('Enter a valid lead passenger email address.');
    const win = BrowserWindow.fromWebContents(event.sender);
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 } });
    const transporter = nodemailer.createTransport({ host: settings.smtpHost, port: Number(settings.smtpPort || 587), secure: Boolean(settings.smtpSecure), auth: { user: settings.smtpUser, pass: settings.password } });
    await transporter.sendMail({
        from: { name: settings.fromName || 'Alfajar Travel UK', address: settings.fromEmail },
        to: String(payload.to).trim(),
        subject: String(payload.subject || 'Your Alfajar Travel invoice'),
        text: String(payload.message || 'Please find your invoice attached. Thank you for booking with Alfajar Travel.'),
        attachments: [{ filename: String(payload.invoiceNumber || 'Alfajar-Invoice').replace(/[^a-z0-9-_]/gi, '-') + '.pdf', content: pdf, contentType: 'application/pdf' }]
    });
    return { sent: true };
});

// Save invoice as PDF
ipcMain.handle('save-pdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const { filePath, canceled } = await dialog.showSaveDialog(win, {
        title: 'Save Alfajar Travel Invoice',
        defaultPath: 'Alfajar-Invoice.pdf',
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return { canceled: true };

    try {
        const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 }
        });

        fs.writeFileSync(filePath, pdfData);
        return { canceled: false, filePath };
    } catch (error) {
        throw new Error('PDF generation failed: ' + error.message);
    }
});

// Print invoice directly
ipcMain.handle('print-invoice', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    return await new Promise((resolve) => {
        win.webContents.print(
            { silent: false, printBackground: true, deviceName: '' },
            (success, failureReason) => resolve({ success, failureReason })
        );
    });
});
