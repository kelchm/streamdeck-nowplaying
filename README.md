# Stream Deck Now Playing Plugin

A Stream Deck plugin that displays currently playing music with album art from any media player on Windows, macOS, or Linux.

## Current Status

✅ **Working:**
- Real-time song title & artist display
- Play/pause toggle on key press
- Plugin loads and connects to Stream Deck
- Responsive updates when music changes
- Cross-platform compatible (Windows/macOS/Linux ready)

❓ **Album Art:** Limited support - depends on media player providing artwork through system APIs. Some players (Spotify) may provide this, others may not.

## Features

- 🎵 **Real-time Updates**: Automatically updates when your music changes
- 🖼️ **Album Art**: Displays album artwork on the Stream Deck key
- 🎮 **Play/Pause Control**: Press the key to toggle play/pause
- 🔄 **Cross-Platform**: Works with Spotify, iTunes, Windows Media Player, and other media players
- 📊 **Track Info**: Shows song name and artist on the key

## Requirements

- Stream Deck software (version 6.0 or later)
- Node.js 20+ (automatically handled by Stream Deck)
- A media player that supports system media controls

## Installation

### For Development/Testing

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd streamdeck-nowplaying
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the plugin**
   ```bash
   npm run build
   ```

4. **Link to Stream Deck**
   
   Create a symbolic link from your Stream Deck plugins folder to this directory:
   
   **Windows (PowerShell as Administrator):**
   ```powershell
   New-Item -ItemType SymbolicLink -Path "$env:APPDATA\Elgato\StreamDeck\Plugins\com.streamdeck.nowplaying.sdPlugin" -Target "$(Get-Location)"
   ```
   
   **macOS:**
   ```bash
   ln -s "$(pwd)" ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/com.streamdeck.nowplaying.sdPlugin
   ```

5. **Restart Stream Deck software**

### For Production

1. Build the plugin: `npm run build`
2. Package as `.streamDeckPlugin` file (requires Stream Deck CLI or manual packaging)
3. Double-click the `.streamDeckPlugin` file to install

## Usage

1. Open Stream Deck software
2. Find "Now Playing" in the Media category
3. Drag it to a key on your Stream Deck
4. Play some music in any supported media player
5. The key will automatically update with:
   - Album artwork
   - Song name
   - Artist name

**Press the key** to toggle play/pause

## Development

### File Structure

```
streamdeck-nowplaying/
├── manifest.json          # Plugin manifest for Stream Deck
├── src/
│   └── plugin.js         # Main plugin code
├── assets/               # Icons and images
│   ├── action.svg
│   ├── category.svg
│   └── plugin.svg
├── bin/                  # Built plugin files
├── build.js              # Build script
└── package.json
```

### Build & Watch

```bash
# Build once
npm run build

# Watch for changes and rebuild
npm run watch

# Test the plugin code directly
npm test
```

### How It Works

The plugin uses:
- **node-nowplaying**: A cross-platform Node.js library that monitors system media players
- **@elgato/streamdeck**: Official Elgato Stream Deck SDK for Node.js

The plugin subscribes to media events and updates the Stream Deck key in real-time with:
- Current track information (title, artist, album)
- Album artwork (automatically fetched as base64 thumbnail)
- Playback state (playing/paused)

## Supported Media Players

Works with any player that integrates with the system media controls:
- **Windows**: Spotify, iTunes, Windows Media Player, Groove Music, VLC, etc.
- **macOS**: Spotify, Apple Music, iTunes, VLC, etc.
- **Linux**: Spotify, Rhythmbox, VLC, and MPRIS-compatible players

## Troubleshooting

### Plugin doesn't appear in Stream Deck

- Make sure you restarted the Stream Deck software after installation
- Check that the symbolic link was created correctly
- Verify `manifest.json` exists in the plugin directory

### No track information showing

- Ensure you have music playing in a supported media player
- Check the Stream Deck logs: `%APPDATA%\Elgato\StreamDeck\logs` (Windows)
- Try pressing play/pause in your media player to trigger an update

### Album art not displaying

- Some media players may not provide album artwork through system APIs
- The plugin will still show track information even without artwork

## License

MIT

## Credits

Built with:
- [node-nowplaying](https://github.com/JoeyEamigh/nowplaying) by JoeyEamigh
- [Stream Deck SDK](https://docs.elgato.com/sdk/) by Elgato
