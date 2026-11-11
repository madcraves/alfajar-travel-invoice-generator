# Alfajar Travel UK — Invoice Manager

Offline Windows desktop invoice application built with Electron.

## Features
- **Invoice Generator:** create invoices with passenger, booking, flight, accommodation, transport and payment details.
- **Editable Terms & Conditions:** update the terms before saving; the terms are included in the invoice preview and printed/PDF invoice.
- **Generated Invoices:** save invoices locally, reopen and edit them, print/export them, or delete them.
- **Print and PDF export:** use the Windows print dialog or save a PDF.
- **Local-only storage:** saved invoice records stay in the local application profile; they are not uploaded to a server.

## Build the Windows installer using GitHub
1. Open the repository's **Actions** tab.
2. Run **Build Windows Installer** (or push a commit to the configured branch).
3. Open the successful workflow run, scroll to **Artifacts**, and download `Alfajar-Travel-Windows-Installer`.
4. Extract the artifact to get the Windows `.exe` installer.

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
