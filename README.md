# Alfajar Travel UK — Invoice Manager

Offline Windows desktop invoice application built with Electron.

## Features
- **Invoice Generator:** create invoices with passenger, booking, flight, accommodation, transport and payment details.
- **Editable Terms & Conditions:** update the terms before saving; the terms are included in the invoice preview and printed/PDF invoice.
- **Generated Invoices:** save invoices locally, reopen and edit them, print/export them, or delete them.
- **Print and PDF export:** use the Windows print dialog or save a PDF.
- **Local-only storage:** saved invoice records stay in the local application profile; they are not uploaded to a server.
- **Automatic updates:** installed versions check GitHub Releases when the app opens and periodically while running. Users can also click **Check for Updates** in the header. Available updates can be downloaded and installed with an automatic restart.
- **Email invoices:** add a separate lead-passenger email address to each invoice and send the invoice PDF directly from the Email Invoice section.
- **Configurable sender account:** configure Alfajar Travel's sender address and SMTP settings in the app. SMTP passwords are encrypted using the operating system's secure credential storage.

## Build the Windows installer using GitHub
1. Open the repository's **Actions** tab.
2. Run **Build Windows Installer** (or push a commit to the configured branch).
3. Open the repository's **Releases** page: https://github.com/madcraves/alfajar-travel-invoice-generator/releases.
4. Open the latest release and download `Alfajar-Travel-Invoice-Generator-Setup-X.Y.Z.exe`. The release also includes `latest.yml` and a `.blockmap` file for automatic updates. You do not need to download anything from the Actions **Artifacts** section.

## Configure invoice email
1. In **Alfajar Travel email account settings**, enter the sender email address, SMTP host, port, username and password/app password supplied by the email hosting provider.
2. Select SSL/TLS when required by the provider (commonly port 465; port 587 commonly uses STARTTLS).
3. Click **Save Email Settings**.
4. Enter the lead passenger email in the invoice. The Email Invoice section is prefilled with that address; edit the subject/message if needed and click **Send Invoice Email**. The current invoice preview is attached as a PDF.

The app does not guess SMTP server settings. Confirm the correct SMTP host, port, security mode and app-password requirements with the Alfajar email provider before sending.

## Publish an update release
1. Increase the `version` in `package.json` (for example, from `1.0.1` to `1.0.2`).
2. Commit and push the change to the default branch.
3. Create and push a matching version tag, for example `v1.0.2`.
4. The **Build Windows Installer** workflow publishes a GitHub Release with the installer and update metadata. Installed copies then detect it automatically.

The tag version must match the `package.json` version. Every successful push to the configured branch is published as a GitHub Release by the current workflow. GitHub Releases must remain publicly accessible so installed copies can check and download updates without a GitHub login.

## Build locally (optional)
Install Node.js 20 LTS, then run:
```bash
npm install
npm run dist
```
Installer output is in `dist/`.

## Alfajar Travel details
The application is prefilled with the contact details published on the Alfajar Travel website:
- Website: https://alfajartravel.co.uk
- Email: book@alfajartravel.co.uk
- Phone: +44 7465 796629

The business address, ATOL/registration information and bank/payment details remain editable and should only be completed with verified company information.

## Important before issuing real invoices
The editable Terms & Conditions are starter wording only, not approved legal advice. Alfajar Travel should review and approve them before use. Financial protection wording must accurately reflect the specific booking and any applicable ATOL protection. Never enter an ATOL number, registered address or bank details unless verified.

Do not publish real customer invoices or passenger personal information in this public repository. Invoice records are stored locally on the computer running the application.

## Invoice management features

- Dashboard with invoice totals, outstanding balances, paid counts and recent invoices.
- Search invoices by invoice number, passenger, booking reference, phone or email.
- Filter saved invoices by paid, partially paid, unpaid and overdue status.
- Payment due dates and automatic balance calculation from total, amount received and other credit.
- Export and restore invoice backups in JSON format. Restore can merge with or replace existing records.
- Invoice data remains stored locally on the computer; create regular backups and store them securely.
