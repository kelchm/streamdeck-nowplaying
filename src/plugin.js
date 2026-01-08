const { streamDeck } = require('@elgato/streamdeck');
const { NowPlaying } = require('node-nowplaying');
const fs = require('fs');
const path = require('path');

// Custom logger that writes to a file
const logFile = path.join(__dirname, '..', 'debug.log');
function log(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ')}\n`;
  fs.appendFileSync(logFile, message);
  console.log(...args);
}

log('Plugin starting...');

let nowPlayingInstance = null;
let currentTrackInfo = null;
let actionContexts = new Set();

const ACTION_UUID = 'com.streamdeck.nowplaying.display';

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
      updateAllActions();
    });
    
    await nowPlayingInstance.subscribe();
    log('Successfully subscribed to now playing events');
  } catch (error) {
    log('Error initializing nowplaying:', error);
  }
}

// Update a specific action with current track info
async function updateAction(action) {
  if (!currentTrackInfo) {
    try {
      await action.setTitle('No Track');
      // Set default icon
      await action.setImage('assets/action');
    } catch (error) {
      log('Error setting no track state:', error);
    }
    return;
  }
  
  const { trackName, artist, thumbnail } = currentTrackInfo;
  
  log('Updating action with track:', trackName, 'Artist:', artist, 'Has thumbnail:', !!thumbnail);
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

// Update all visible instances of the action
async function updateAllActions() {
  for (const action of actionContexts) {
    await updateAction(action);
  }
}

// Register event handlers
const actionService = streamDeck.actions;

// willAppear event
actionService.registerAction({
  manifestId: ACTION_UUID,
  onWillAppear: async function(ev) {
    log('Now Playing action appeared:', ev.action.id);
    actionContexts.add(ev.action);
    
    await initializeNowPlaying();
    
    if (currentTrackInfo) {
      await updateAction(ev.action);
    } else {
      await ev.action.setTitle('No Track');
    }
  },
  
  onWillDisappear: async function(ev) {
    log('Now Playing action disappeared:', ev.action.id);
    actionContexts.delete(ev.action);
    
    // Clean up if no instances left
    if (actionContexts.size === 0 && nowPlayingInstance) {
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
    log('Key pressed on Now Playing action');
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

// Connect to Stream Deck
streamDeck.connect();

log('Now Playing plugin started');
