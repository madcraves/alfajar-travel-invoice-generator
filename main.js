const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let updatePromptOpen = false;
let updateDownloadStarted = false;

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

    autoUpdater.on('update-available', async (info) => {
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

    autoUpdater.on('update-downloaded', async (info) => {
        const version = info.version || 'the latest version';
        await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'Version ' + version + ' has been downloaded successfully.',
            detail: 'The application will now restart to install the update. Your saved invoices will be kept.',
            buttons: ['Restart & Install'],
            defaultId: 0,
            noLink: true
        });

        // The user already chose Download & Install in the update popup.
        autoUpdater.quitAndInstall(true, true);
    });

    autoUpdater.on('error', (error) => {
        console.error('Auto-update error:', error);
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
