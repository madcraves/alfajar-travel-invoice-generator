const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
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

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

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
        filters: [
            { name: 'PDF Documents', extensions: ['pdf'] }
        ]
    });

    if (canceled || !filePath) {
        return { canceled: true };
    }

    try {
        const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: {
                top: 0.35,
                bottom: 0.35,
                left: 0.35,
                right: 0.35
            }
        });

        fs.writeFileSync(filePath, pdfData);

        return {
            canceled: false,
            filePath: filePath
        };

    } catch (error) {
        throw new Error('PDF generation failed: ' + error.message);
    }
});

// Print invoice directly
ipcMain.handle('print-invoice', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    return await new Promise((resolve) => {
        win.webContents.print(
            {
                silent: false,
                printBackground: true,
                deviceName: ''
            },
            (success, failureReason) => {
                resolve({
                    success: success,
                    failureReason: failureReason
                });
            }
        );
    });
});
