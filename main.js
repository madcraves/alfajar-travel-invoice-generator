const { app, BrowserWindow, ipcMain, dialog, Notification, safeStorage, shell } = require('electron');
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let updateDownloadStarted = false;
let updateInstallStarted = false;
let manualUpdateCheck = false;
const inboxAttachmentCache = new Map();
const emailSettingsPath = () => path.join(app.getPath('userData'), 'email-settings.json');
function readEmailSettings() {
    try {
        const saved = JSON.parse(fs.readFileSync(emailSettingsPath(), 'utf8'));
        const decrypt = (value) => value && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(value, 'base64')) : '';
        const sharedPassword = decrypt(saved.passwordEncrypted) || decrypt(saved.imapPasswordEncrypted);
        return { ...saved, password: sharedPassword, imapPassword: sharedPassword };
    } catch (_) { return {}; }
}
function writeEmailSettings(settings) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is not available on this computer.');
    const sharedPassword = String(settings.password || settings.imapPassword || '').trim();
    const passwordEncrypted = sharedPassword ? safeStorage.encryptString(sharedPassword).toString('base64') : '';
    const stored = {
        fromEmail: String(settings.fromEmail || settings.imapEmail || 'invoice@alfajartravel.co.uk').trim(), fromName: String(settings.fromName || 'Alfajar Travel UK').trim(),
        smtpHost: String(settings.smtpHost || 'smtp.hostinger.com').trim(), smtpPort: Number(settings.smtpPort || 465), smtpSecure: settings.smtpSecure !== false, smtpUser: String(settings.smtpUser || settings.fromEmail || settings.imapEmail || 'invoice@alfajartravel.co.uk').trim(), passwordEncrypted,
        imapEmail: String(settings.imapEmail || 'invoice@alfajartravel.co.uk').trim(), imapHost: String(settings.imapHost || 'imap.hostinger.com').trim(),
        imapPort: Number(settings.imapPort || 993), imapSecure: settings.imapSecure !== false, imapUser: String(settings.imapUser || settings.imapEmail || 'invoice@alfajartravel.co.uk').trim(), imapPasswordEncrypted: passwordEncrypted
    };
    fs.writeFileSync(emailSettingsPath(), JSON.stringify(stored, null, 2), { mode: 0o600 });
    return { fromEmail: stored.fromEmail, configured: Boolean(stored.fromEmail && stored.smtpHost && stored.smtpUser && passwordEncrypted), inboxConfigured: Boolean(stored.imapEmail && stored.imapHost && stored.imapUser && passwordEncrypted) };
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
    if (!app.isPackaged || updateDownloadStarted || updateInstallStarted) return;
    try {
        await autoUpdater.checkForUpdates();
    } catch (error) {
        console.error('Update check failed:', error);
        if (manualUpdateCheck && mainWindow) {
            manualUpdateCheck = false;
            await dialog.showMessageBox(mainWindow, { type: 'error', title: 'Update Check Failed', message: 'Could not check for updates.', detail: error.message, buttons: ['OK'] });
        }
    }
}

function configureAutoUpdates() {
    if (!app.isPackaged) return;
    // Detect and download published updates automatically in the background.
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;

    autoUpdater.on('checking-for-update', () => {
        if (mainWindow) mainWindow.webContents.send('update-status', { state: 'checking' });
    });
    autoUpdater.on('update-not-available', async () => {
        if (mainWindow) mainWindow.webContents.send('update-status', { state: 'latest' });
        if (manualUpdateCheck && mainWindow) {
            manualUpdateCheck = false;
            await dialog.showMessageBox(mainWindow, { type: 'info', title: 'No Updates Available', message: 'You are using the latest version of Alfajar Travel Invoice Generator.', buttons: ['OK'] });
        }
    });
    autoUpdater.on('update-available', (info) => {
        manualUpdateCheck = false;
        updateDownloadStarted = true;
        if (mainWindow) mainWindow.webContents.send('update-status', { state: 'downloading', version: info.version || '' });
        if (Notification.isSupported()) new Notification({ title: 'Alfajar Travel update found', body: 'Version ' + (info.version || 'new version') + ' is downloading automatically.' }).show();
    });
    autoUpdater.on('download-progress', (progress) => {
        if (mainWindow) {
            mainWindow.setProgressBar(Math.max(0, Math.min(1, (progress.percent || 0) / 100)));
            mainWindow.webContents.send('update-status', { state: 'downloading', percent: Math.round(progress.percent || 0) });
        }
    });
    autoUpdater.on('update-downloaded', (info) => {
        if (updateInstallStarted) return;
        updateInstallStarted = true;
        if (mainWindow) {
            mainWindow.setProgressBar(-1);
            mainWindow.webContents.send('update-status', { state: 'installing', version: info.version || '' });
        }
        if (Notification.isSupported()) new Notification({ title: 'Installing Alfajar Travel update', body: 'The update is ready. The app will restart automatically.' }).show();
        // Run the downloaded NSIS installer and relaunch the updated application.
        setTimeout(() => autoUpdater.quitAndInstall(true, true), 1200);
    });
    autoUpdater.on('error', async (error) => {
        updateDownloadStarted = false;
        updateInstallStarted = false;
        if (mainWindow) {
            mainWindow.setProgressBar(-1);
            mainWindow.webContents.send('update-status', { state: 'error' });
        }
        console.error('Auto-update error:', error);
        if (manualUpdateCheck && mainWindow) {
            manualUpdateCheck = false;
            await dialog.showMessageBox(mainWindow, { type: 'error', title: 'Update Failed', message: 'The update could not be downloaded.', detail: error.message, buttons: ['OK'] });
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
    if (updateDownloadStarted || updateInstallStarted) return { message: 'An update is already downloading or installing automatically.' };
    manualUpdateCheck = true;
    try { await autoUpdater.checkForUpdates(); return { checking: true }; }
    catch (error) { manualUpdateCheck = false; throw new Error('Update check failed: ' + error.message); }
});

ipcMain.handle('get-email-settings', async () => {
    const s = readEmailSettings();
    return {
        fromEmail: s.fromEmail || s.imapEmail || 'invoice@alfajartravel.co.uk', fromName: s.fromName || 'Alfajar Travel UK', smtpHost: s.smtpHost || 'smtp.hostinger.com', smtpPort: s.smtpPort || 465, smtpSecure: s.smtpSecure !== false, smtpUser: s.smtpUser || s.fromEmail || s.imapEmail || 'invoice@alfajartravel.co.uk', hasPassword: Boolean(s.password),
        imapEmail: s.imapEmail || 'invoice@alfajartravel.co.uk', imapHost: s.imapHost || 'imap.hostinger.com', imapPort: s.imapPort || 993, imapSecure: s.imapSecure !== false, imapUser: s.imapUser || s.imapEmail || 'invoice@alfajartravel.co.uk', hasImapPassword: Boolean(s.imapPassword)
    };
});

ipcMain.handle('save-email-settings', async (_event, settings) => {
    if (!settings || !settings.fromEmail || !settings.smtpHost || !settings.smtpUser) throw new Error('Please enter the sender email, SMTP host and SMTP username.');
    const current = readEmailSettings();
    const sharedPassword = settings.password || settings.imapPassword || current.password || current.imapPassword;
    if (!sharedPassword) throw new Error('Please enter the Hostinger mailbox password.');
    settings.password = sharedPassword;
    return writeEmailSettings(settings);
});

ipcMain.handle('get-email-connection-status', async () => {
 const s = readEmailSettings();
 const configured = Boolean(s.fromEmail && s.smtpHost && s.smtpUser && s.imapEmail && s.imapHost && s.imapUser && s.password);
 const result = { configured, sending: { state: 'not-configured', message: 'Email settings or mailbox password are missing.' }, receiving: { state: 'not-configured', message: 'Email settings or mailbox password are missing.' }, checkedAt: new Date().toISOString() };
 if (!configured) return result;
 const transporter = nodemailer.createTransport({ host: s.smtpHost, port: Number(s.smtpPort || 465), secure: Boolean(s.smtpSecure), connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 15000, auth: { user: s.smtpUser, pass: s.password } });
 try { await transporter.verify(); result.sending = { state: 'connected', message: 'SMTP connection and authentication successful.' }; } catch (e) { result.sending = { state: 'error', message: e.message }; } finally { try { transporter.close(); } catch (_) {} }
 const client = new ImapFlow({ host: s.imapHost, port: Number(s.imapPort || 993), secure: s.imapSecure !== false, auth: { user: s.imapUser, pass: s.imapPassword }, logger: false, socketTimeout: 15000 });
 try { await client.connect(); result.receiving = { state: 'connected', message: 'IMAP connection and authentication successful.' }; } catch (e) { result.receiving = { state: 'error', message: e.message }; } finally { try { await client.logout(); } catch (_) {} }
 result.checkedAt = new Date().toISOString(); return result;
});
async function findSentMailbox(client) {
 const folders=await client.list();
 const sentFolder=folders.find(folder=>String(folder.specialUse||'').toLowerCase()==='\\sent')||folders.find(folder=>/^(sent|sent items|sent messages|inbox[./]sent)$/i.test(String(folder.path||'')))||folders.find(folder=>/sent/i.test(String(folder.path||'')));
 if(!sentFolder)throw new Error('Hostinger Sent folder was not found. Check the mailbox folders in Hostinger Webmail.');
 return sentFolder.path;
}
function base64Lines(value){return Buffer.from(value).toString('base64').replace(/.{1,76}/g,'$&\r\n').trim()}
function makeInvoiceEmailMime({from,to,subject,text,filename,pdf}){
 const boundary='----AlfajarInvoice'+Date.now().toString(16),encodedSubject='=?UTF-8?B?'+Buffer.from(subject,'utf8').toString('base64')+'?=',safeFilename=String(filename).replace(/["\r\n]/g,'_');
 return ['From: '+from,'To: '+to,'Date: '+new Date().toUTCString(),'Subject: '+encodedSubject,'MIME-Version: 1.0','Content-Type: multipart/mixed; boundary="'+boundary+'"','','--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',base64Lines(text),'--'+boundary,'Content-Type: application/pdf; name="'+safeFilename+'"','Content-Transfer-Encoding: base64','Content-Disposition: attachment; filename="'+safeFilename+'"','',base64Lines(pdf),'--'+boundary+'--',''].join('\r\n');
}
ipcMain.handle('get-sent-emails',async()=>{
 const settings=readEmailSettings();
 if(!settings.imapEmail||!settings.imapHost||!settings.imapUser||!settings.imapPassword)throw new Error('Configure the Hostinger mailbox in Email Settings first.');
 const client=new ImapFlow({host:settings.imapHost,port:Number(settings.imapPort||993),secure:settings.imapSecure!==false,auth:{user:settings.imapUser,pass:settings.imapPassword},logger:false}),messages=[];
 try{
  await client.connect();const folder=await findSentMailbox(client),lock=await client.getMailboxLock(folder);
  try{
   const uids=await client.search({all:true},{uid:true});
   for(const uid of (uids||[]).slice(-100).reverse()){
    for await(const msg of client.fetch(String(uid),{uid:true,internalDate:true,source:true},{uid:true})){
     const parsed=await simpleParser(msg.source),recipient=parsed.to?.value?.[0]||{},attachments=parsed.attachments||[],pdfAttachment=attachments.find(a=>/\.pdf$/i.test(a.filename||'')),subject=String(parsed.subject||'(No subject)'),match=subject.match(/AT-\d{4}-\d+/i)||(pdfAttachment?.filename||'').match(/AT-\d{4}-\d+/i);
     messages.push({id:String(msg.uid),to:recipient.name?recipient.name+' <'+(recipient.address||'')+'>':(recipient.address||''),from:parsed.from?.text||settings.fromEmail,subject,invoiceNumber:match?match[0]:'',sentAt:(parsed.date||msg.internalDate||new Date()).toISOString(),status:'sent',attachment:pdfAttachment?.filename||(attachments.length?attachments[0].filename:'No attachment')});
    }
   }
  }finally{lock.release()}
 }finally{try{await client.logout()}catch(_){}}
 return messages;
});
ipcMain.handle('get-inbox-emails', async () => {
    const settings = readEmailSettings();
    if (!settings.imapEmail || !settings.imapHost || !settings.imapUser || !settings.imapPassword) throw new Error('Open Email Settings and enter the invoice@alfajartravel.co.uk mailbox password first.');
    const client = new ImapFlow({
        host: settings.imapHost, port: Number(settings.imapPort || 993), secure: settings.imapSecure !== false,
        auth: { user: settings.imapUser, pass: settings.imapPassword }, logger: false
    });
    const messages = [];
    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        try {
            const uids = await client.search({ all: true }, { uid: true });
            const recent = (uids || []).slice(-50).reverse();
            for (const uid of recent) {
                for await (const msg of client.fetch(String(uid), { uid: true, envelope: true, flags: true, internalDate: true, source: true }, { uid: true })) {
                    const parsed = await simpleParser(msg.source);
                    const from = parsed.from?.value?.[0] || {};
                    const attachments = (parsed.attachments || []).map((a, index) => {
                        const id = String(msg.uid) + ':' + index;
                        inboxAttachmentCache.set(id, { content: a.content, filename: a.filename || ('attachment-' + (index + 1)), contentType: a.contentType || 'application/octet-stream' });
                        return { id, filename: a.filename || ('attachment-' + (index + 1)), contentType: a.contentType || '', size: a.size || 0 };
                    });
                    const body = String(parsed.text || parsed.html || '').replace(/<[^>]*>/g, ' ').slice(0, 12000);
                    const subject = String(parsed.subject || msg.envelope?.subject || '(No subject)');
                    const signedCandidate = /signed|signature|signed invoice/i.test(subject + ' ' + body) || attachments.some(a => /\.pdf$/i.test(a.filename));
                    messages.push({
                        uid: msg.uid, from: from.name ? from.name + ' <' + (from.address || '') + '>' : (from.address || 'Unknown sender'),
                        subject, date: (parsed.date || msg.internalDate || new Date()).toISOString(),
                        text: body, unread: !Array.from(msg.flags || []).includes('\\Seen'),
                        signedCandidate, attachments
                    });
                }
            }
        } finally { lock.release(); }
    } finally {
        try { await client.logout(); } catch (_) {}
    }
    return messages;
});

ipcMain.handle('save-inbox-attachment', async (event, attachmentId) => {
    const attachment = inboxAttachmentCache.get(String(attachmentId || ''));
    if (!attachment) throw new Error('This attachment is no longer available. Refresh the Inbox and try again.');
    const win = BrowserWindow.fromWebContents(event.sender);
    const safeName = String(attachment.filename || 'email-attachment').replace(/[\\/:*?"<>|]/g, '_');
    const result = await dialog.showSaveDialog(win, { title: 'Save email attachment', defaultPath: safeName, filters: [{ name: 'All files', extensions: ['*'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, attachment.content);
    return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('send-invoice-email',async(event,payload)=>{
 const settings=readEmailSettings();
 if(!settings.fromEmail||!settings.smtpHost||!settings.smtpUser||!settings.password)throw new Error('Please configure and save your Alfajar Travel email settings first.');
 if(!settings.imapHost||!settings.imapUser||!settings.imapPassword)throw new Error('Configure the Hostinger IMAP mailbox to archive sent invoices.');
 if(!payload||!/^\S+@\S+\.\S+$/.test(String(payload.to||'')))throw new Error('Enter a valid lead passenger email address.');
 const win=BrowserWindow.fromWebContents(event.sender),pdf=await win.webContents.printToPDF({printBackground:true,pageSize:'A4',margins:{top:0.35,bottom:0.35,left:0.35,right:0.35}});
 const recipient=String(payload.to).trim(),subject=String(payload.subject||'Your Alfajar Travel invoice'),message=String(payload.message||'Please find your invoice attached. Thank you for booking with Alfajar Travel.'),attachment=String(payload.invoiceNumber||'Alfajar-Invoice').replace(/[^a-z0-9-_]/gi,'-')+'.pdf';
 const transporter=nodemailer.createTransport({host:settings.smtpHost,port:Number(settings.smtpPort||465),secure:Boolean(settings.smtpSecure),auth:{user:settings.smtpUser,pass:settings.password}});
 await transporter.sendMail({from:{name:settings.fromName||'Alfajar Travel UK',address:settings.fromEmail},to:recipient,subject,text:message,attachments:[{filename:attachment,content:pdf,contentType:'application/pdf'}]});
 const archiveClient=new ImapFlow({host:settings.imapHost,port:Number(settings.imapPort||993),secure:settings.imapSecure!==false,auth:{user:settings.imapUser,pass:settings.imapPassword},logger:false});
 try{
  await archiveClient.connect();const sentFolder=await findSentMailbox(archiveClient);
  const rawMessage=makeInvoiceEmailMime({from:(settings.fromName||'Alfajar Travel UK')+' <'+settings.fromEmail+'>',to:recipient,subject,text:message,filename:attachment,pdf});
  await archiveClient.append(sentFolder,Buffer.from(rawMessage,'utf8'),['\\Seen'],new Date());
 }catch(archiveError){console.error('Invoice email sent, but Hostinger Sent-folder archiving failed:',archiveError);return{sent:true,archived:false,archiveError:archiveError.message}}
 finally{try{await archiveClient.logout()}catch(_){}}
 return{sent:true,archived:true};
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

// Generate the saved invoice PDF and return it to the in-app PDF viewer.
ipcMain.handle('view-pdf', async (event, invoiceNumber) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
        const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            preferCSSPageSize: true,
            margins: { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 }
        });
        if (!pdfData || pdfData.length < 100) throw new Error('The generated PDF is empty.');
        return { success: true, invoiceNumber: String(invoiceNumber || ''), pdfBase64: pdfData.toString('base64') };
    } catch (error) {
        throw new Error('Unable to generate invoice PDF: ' + error.message);
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
