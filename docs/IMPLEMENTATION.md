# Extension Implementation Guide

## Files Structure
- manifest.json - Extension configuration
- background.js - Background service worker
- content.js - Content script
- popup.html - UI for the extension popup
- popup.js - Scripts for the popup
- cookie_specs.json - JSON file containing cookie specifications
- images/ - Directory containing icon files

## Installation Steps
1. Create a new directory for the extension
2. Create all the files mentioned above with the content provided
3. To load the extension in Chrome for testing:
   - Open Chrome and go to chrome://extensions
   - Enable Developer mode (toggle in top right)
   - Click "Load unpacked" and select your extension directory

## How it Works
1. The extension loads cookie specifications from the JSON file
2. When the user clicks "Validate Cookies" in the popup:
   - The popup sends a message to the background script
   - The background script gets all cookies for the current domain
   - It checks each cookie against the specifications
   - It identifies cookies declared as "session" but persist longer than 24 hours
   - Results are sent back to the popup for display

## Testing
You can use the test utility to simulate cookies and test the extension functionality.

## Notes
- This extension needs the correct permissions to access cookies
- The cookie specifications should be regularly updated to maintain accuracy
- In a production environment, you might want to add more robust error handling
