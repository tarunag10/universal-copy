# Universal Copy

A browser extension to bypass copy restrictions on restricted websites. Unlock right-click, text selection, and keyboard shortcuts on any site.

## Features

- 🔓 **One-Click Unlock** - Instantly bypass copy restrictions
- ✨ **Text Cleaner** - Remove ads and formatting from copied text
- 🔗 **URL Cleaner** - Strip tracking parameters from URLs
- 📷 **OCR** - Extract text from images
- 📝 **Snippets** - Save and reuse text snippets
- 📊 **Statistics** - Track unlock history

## Installation

### Chrome
1. Build the project: `npm run build`
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

### Safari
Use Xcode's Safari Web Extension Converter:
```bash
xcrun safari-web-extension-converter /path/to/dist
```

## Development

```bash
npm install
npm run dev
```

## Project Structure

```
├── dist/              # Built extension files
├── public/            # Extension source files
│   ├── background.js  # Service worker
│   ├── content.js    # Content script
│   ├── unlocker.js   # Bypass logic
│   ├── popup.html   # Extension popup
│   └── manifest.json # Extension manifest
├── src/              # Dashboard source
│   ├── App.tsx       # Main app component
│   └── main.tsx      # Entry point
└── package.json       # Dependencies
```

## License

MIT
