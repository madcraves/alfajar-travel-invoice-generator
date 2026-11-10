const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('invoiceAPI', {

    // Save invoice as PDF
    savePDF: () => {
        return ipcRenderer.invoke('save-pdf');
    },

    // Print invoice
    print: () => {
        return ipcRenderer.invoke('print-invoice');
    }

});
