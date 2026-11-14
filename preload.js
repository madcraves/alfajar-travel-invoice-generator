const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('invoiceAPI', {
    savePDF: () => ipcRenderer.invoke('save-pdf'),
    viewPDF: (invoiceNumber) => ipcRenderer.invoke('view-pdf', invoiceNumber),
    print: () => ipcRenderer.invoke('print-invoice'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates-manual'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, status) => callback(status)),
    getEmailSettings: () => ipcRenderer.invoke('get-email-settings'),
    saveEmailSettings: (settings) => ipcRenderer.invoke('save-email-settings', settings),
    sendInvoiceEmail: (payload) => ipcRenderer.invoke('send-invoice-email', payload),
    getInboxEmails: () => ipcRenderer.invoke('get-inbox-emails'),
    getEmailConnectionStatus: () => ipcRenderer.invoke('get-email-connection-status'),
    getSentEmails: () => ipcRenderer.invoke('get-sent-emails'),
    saveInboxAttachment: (attachmentId) => ipcRenderer.invoke('save-inbox-attachment', attachmentId)
});
