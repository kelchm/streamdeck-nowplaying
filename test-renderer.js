/**
 * Simple test to validate the renderer works correctly
 * Run with: node test-renderer.js
 */

const NowPlayingRenderer = require('./bin/renderer.js');
const fs = require('fs');
const path = require('path');

async function testRenderer() {
  const renderer = new NowPlayingRenderer();

  // Test track info with album art
  const testTrackInfo = {
    trackName: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    thumbnail: null, // We'll skip actual image for this test
    duration: 244,
    position: 122
  };

  console.log('Testing NowPlayingRenderer...');
  console.log('Input:', testTrackInfo);

  try {
    // Test rendering without album art (just to check SVG/canvas generation)
    const renderedImage = await renderer.render(testTrackInfo);
    
    console.log('✓ Render successful!');
    console.log('Output type:', typeof renderedImage);
    console.log('Data URL length:', renderedImage.length);
    console.log('First 100 chars:', renderedImage.substring(0, 100));

    // Test fallback rendering
    const fallbackImage = await renderer.createFallback();
    console.log('✓ Fallback render successful!');
    console.log('Fallback length:', fallbackImage.length);

  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }

  console.log('\nAll tests passed!');
}

testRenderer();
