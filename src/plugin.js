const { streamDeck } = require('@elgato/streamdeck');
const { NowPlaying } = require('node-nowplaying');
const fs = require('fs');
const path = require('path');
const NowPlayingRenderer = require('./renderer');

// Custom logger that writes to a file
const logFile = path.join(__dirname, '..', 'debug.log');
function log(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ')}\n`;
  fs.appendFileSync(logFile, message);
  console.log(...args);
}

// Global error handlers to catch unhandled errors
process.on('uncaughtException', (error) => {
  log('UNCAUGHT EXCEPTION:', error.message, error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  log('UNHANDLED REJECTION:', reason, 'Promise:', promise, 'Stack:', reason?.stack);
});

log('Plugin starting...');

let nowPlayingInstance = null;
let currentTrackInfo = null;
let keypadContexts = new Set();
let lcdContexts = new Set();
const renderer = new NowPlayingRenderer();

const ACTION_UUID_KEYPAD = 'com.streamdeck.nowplaying.display';
const ACTION_UUID_LCD = 'com.streamdeck.nowplaying.lcd';

// Initialize nowplaying
async function initializeNowPlaying() {
  if (nowPlayingInstance) return;
  
  try {
    nowPlayingInstance = new NowPlaying((event) => {
      log('=== NowPlaying Event Received ===');
      log('Full event object keys:', Object.keys(event));
      log('trackName:', event.trackName);
      log('artist:', event.artist);
      log('album:', event.album);
      log('thumbnail type:', typeof event.thumbnail);
      log('thumbnail exists:', !!event.thumbnail);
      if (event.thumbnail) {
        log('thumbnail length:', event.thumbnail.length);
        log('thumbnail first 100 chars:', event.thumbnail.substring(0, 100));
      }
      log('isPlaying:', event.isPlaying);
      log('=================================');
      
      currentTrackInfo = event;
      updateAllActions().catch(err => log('Error in updateAllActions:', err));
    });
    
    await nowPlayingInstance.subscribe();
    log('Successfully subscribed to now playing events');
  } catch (error) {
    log('Error initializing nowplaying:', error);
  }
}

// Update all keypad instances
async function updateAllKeypads() {
  log('updateAllKeypads: keypadContexts size =', keypadContexts.size);
  for (const action of keypadContexts) {
    try {
      await updateKeypadAction(action);
    } catch (err) {
      log('Error updating keypad action:', err, err?.message, err?.stack);
    }
  }
}

// Update all LCD instances
async function updateAllLCDs() {
  log('updateAllLCDs: lcdContexts size =', lcdContexts.size);
  for (const action of lcdContexts) {
    try {
      const position = action._position || 'left';
      await updateLCDAction(action, position);
    } catch (err) {
      log('Error updating LCD action:', err, err?.message, err?.stack);
    }
  }
}

// Update all visible instances
async function updateAllActions() {
  log('updateAllActions called');
  log('keypadContexts size:', keypadContexts.size);
  log('lcdContexts size:', lcdContexts.size);
  
  for (const action of keypadContexts) {
    log('Updating keypad action...');
    try {
      await updateKeypadAction(action);
      log('Keypad action updated successfully');
    } catch (err) {
      log('Error updating keypad action:', String(err), err?.message, err?.stack);
    }
  }
  
  for (const action of lcdContexts) {
    log('Updating LCD action...');
    try {
      const position = action._position || 'left';
      await updateLCDAction(action, position);
      log('LCD action updated successfully');
    } catch (err) {
      log('Error updating LCD action:', String(err), err?.message, err?.stack);
    }
  }
  
  log('updateAllActions finished');
}

// Update a specific keypad action with current track info
async function updateKeypadAction(action) {
  if (!currentTrackInfo || !currentTrackInfo.isPlaying) {
    try {
      await action.setTitle('♪');
      // Set default icon
      await action.setImage('assets/action');
    } catch (error) {
      log('Error setting no track state:', error);
    }
    return;
  }
  
  const { trackName, artist, thumbnail } = currentTrackInfo;
  
  log('Updating keypad action with track:', trackName, 'Artist:', artist, 'Has thumbnail:', !!thumbnail);
  if (thumbnail) {
    log('Thumbnail length:', thumbnail.length);
  }
  
  // Build title text
  const artists = Array.isArray(artist) ? artist.join(', ') : (artist || 'Unknown');
  const title = `${trackName || 'Unknown'}\n${artists}`;
  
  try {
    await action.setTitle(title);
  } catch (error) {
    log('Error setting title:', error);
  }
  
  // Set album art if available, otherwise use default
  if (thumbnail && thumbnail.length > 0) {
    try {
      log('Setting album art image');
      // node-nowplaying already provides the full data URL with prefix
      await action.setImage(thumbnail);
      log('Album art set successfully');
    } catch (error) {
      log('Error setting album art:', error);
      // Fallback to default icon
      await action.setImage('assets/action');
    }
  } else {
    log('No thumbnail available, using default icon');
    try {
      await action.setImage('assets/action');
    } catch (error) {
      log('Error setting default icon:', error);
    }
  }
}

// Update LCD action with rendered image
async function updateLCDAction(action, position = 'left') {
  if (!currentTrackInfo || !currentTrackInfo.isPlaying) {
    try {
      const blankImage = await renderer.createBlank(position);
      await action.setFeedback({ image: blankImage });
    } catch (error) {
      log('Error setting no track state on LCD:', error);
    }
    return;
  }

  log('Updating LCD action with track:', currentTrackInfo.trackName, 'position:', position);
  
  try {
    const renderedImage = await renderer.render(currentTrackInfo, position);
    await action.setFeedback({ image: renderedImage });
    log('LCD rendered successfully for position:', position);
  } catch (error) {
    log('Error rendering LCD image:', error);
    try {
      const fallbackImage = await renderer.createFallback(position);
      await action.setFeedback({ image: fallbackImage });
    } catch (fbError) {
      log('Error setting fallback LCD image:', fbError);
    }
  }
}

// Register event handlers
const actionService = streamDeck.actions;

// Keypad action handler
actionService.registerAction({
  manifestId: ACTION_UUID_KEYPAD,
  onWillAppear: async function(ev) {
    log('Keypad Now Playing action appeared:', ev.action.id);
    keypadContexts.add(ev.action);
    
    await initializeNowPlaying();
    
    await updateKeypadAction(ev.action);
  },
  
  onWillDisappear: async function(ev) {
    log('Keypad Now Playing action disappeared:', ev.action.id);
    keypadContexts.delete(ev.action);
    
    // Clean up if no instances left
    if (keypadContexts.size === 0 && lcdContexts.size === 0 && nowPlayingInstance) {
      try {
        await nowPlayingInstance.unsubscribe();
        nowPlayingInstance = null;
        log('Unsubscribed from now playing events');
      } catch (error) {
        log('Error unsubscribing:', error);
      }
    }
  },
  
  onKeyDown: async function(ev) {
    log('Key pressed on Now Playing keypad action');
    if (nowPlayingInstance) {
      try {
        await nowPlayingInstance.playPause();
        log('Toggled play/pause');
      } catch (error) {
        log('Error toggling playback:', error);
      }
    }
  }
});

// LCD action handler
actionService.registerAction({
  manifestId: ACTION_UUID_LCD,
  onWillAppear: async function(ev) {
    log('LCD Now Playing action appeared:', ev.action.id);
    const settings = ev.payload.settings || {};
    const position = settings.position || 'left';
    log('LCD position setting:', position);
    
    // Store position with the action for later updates
    ev.action._position = position;
    lcdContexts.add(ev.action);
    
    await initializeNowPlaying();
    
    await updateLCDAction(ev.action, position);
  },
  
  onWillDisappear: async function(ev) {
    log('LCD Now Playing action disappeared:', ev.action.id);
    lcdContexts.delete(ev.action);
    
    // Clean up if no instances left
    if (keypadContexts.size === 0 && lcdContexts.size === 0 && nowPlayingInstance) {
      try {
        await nowPlayingInstance.unsubscribe();
        nowPlayingInstance = null;
        log('Unsubscribed from now playing events');
      } catch (error) {
        log('Error unsubscribing:', error);
      }
    }
  },
  
  onDidReceiveSettings: async function(ev) {
    // User changed settings - update position
    const settings = ev.payload.settings || {};
    const position = settings.position || 'left';
    log('LCD settings changed, new position:', position);
    
    ev.action._position = position;
    
    await updateLCDAction(ev.action, position);
  },
  
  onDialRotate: async function(ev) {
    log('Dial rotated on Now Playing LCD action');
    if (nowPlayingInstance) {
      try {
        // Rotate right = seek forward, rotate left = seek backward
        const ticks = ev.payload.ticks;
        const secondsToSeek = ticks > 0 ? 5 : -5;
        await nowPlayingInstance.seek(secondsToSeek);
        log('Sought by', secondsToSeek, 'seconds');
      } catch (error) {
        log('Error seeking:', error);
      }
    }
  }
});

// Connect to Stream Deck
streamDeck.connect();

log('Now Playing plugin started');
