# Alfajar Travel UK — Invoice Generator

Offline Windows desktop invoice generator built with Electron. The app can edit invoice fields, preview the invoice, save records locally, print, and export to PDF.

## Build the Windows installer using GitHub
1. Create a new GitHub repository named `alfajar-travel-invoice-generator`.
2. Extract/upload all files from this project ZIP into the repository (keep `.github/workflows/build-windows.yml`).
3. Commit to `main`.
4. Open the repository's **Actions** tab. Run **Build Windows Installer** (or wait for the push workflow).
5. Open the successful workflow run, scroll to **Artifacts**, and download `Alfajar-Travel-Windows-Installer`. Extract the artifact to get the `.exe` installer.

## Build locally (optional)
Install Node.js 20 LTS, then run:
```bash
npm install
npm run dist
```
Installer output is in `dist/`.

## Important before issuing real invoices
The supplied PDF is an Al-Huda Travel / Flight 380 Ltd invoice. This project reuses its customer/booking facts for a sample only. It intentionally does NOT reuse that other business's terms, ATOL number, bank account or contact details. Complete the verified Alfajar Travel registered name/address, official contact details, applicable ATOL/registration details, bank details and approved terms before issuing customer invoices.

The sample invoice PDF is supplied separately. Customer information is included because it was present in the source invoice; protect it and do not publish the sample PDF in a public repository.
