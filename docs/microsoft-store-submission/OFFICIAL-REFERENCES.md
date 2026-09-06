# Official Microsoft references

Requirements last reviewed: **2026-09-01**

Use Microsoft's current documentation and the live Partner Center UI when they differ from older release notes.

## Account and product setup

- [Open a Microsoft Store developer account](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account)
- [Company account verification requirements](https://learn.microsoft.com/en-us/windows/apps/publish/store-business-verification-reqs)
- [Reserve an EXE/MSI app name](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/reserve-your-apps-name)
- [Create an EXE/MSI app submission](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/create-app-submission)

## Package and certification

- [EXE/MSI app package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)
- [Upload EXE/MSI app packages](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/upload-app-packages)
- [Manual package validation](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/manual-package-validation)
- [EXE/MSI app certification process](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-certification-process)
- [Test an app with Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/test-your-app-with-smart-app-control)

## Listing and assets

- [Add and edit EXE/MSI Store listing information](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/add-and-edit-store-listing-info)
- [Add EXE/MSI additional information](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/add-additional-information)
- [Import and export EXE/MSI Store listings](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/import-and-export-store-listings)
- [EXE/MSI app screenshots and images](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/screenshots-and-images)

## Current requirement snapshot

As of the review date, Microsoft documents these relevant rules:

- EXE/MSI installer and contained PE files must be signed with a certificate chaining to the Microsoft Trusted Root Program.
- Package URL must be direct HTTPS, versioned, and immutable after submission.
- Installer must be standalone/offline and support silent installation.
- Silent installation must work for a standard user; clean uninstall and normal Windows app registration are certification checks.
- At least one listing language and one screenshot are required; four or more screenshots are recommended.
- Description, a screenshot, 1:1 Store logo, and applicable license terms are required for an imported listing.
- Description limit is 10,000 characters; What's new is 1,500; each feature is 200 with a 20-feature maximum.
- Short description can be 1,000 characters, with under 270 recommended for common Store views.
- Seven search terms are allowed, each up to 40 characters, with no more than 21 unique words total.
- For an app's first Store submission, Microsoft's listing guidance says to leave What's new blank.

Recheck these sources before final submission because Microsoft can change requirements independently of this repository.
