const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Renders a now-playing LCD screen with album art and metadata
 * LCD dimensions: typically 800x100 pixels for 2 dial positions on Streamdeck Plus
 */
class NowPlayingRenderer {
  constructor() {
    this.fullWidth = 400;   // Full width for both positions combined
    this.dialWidth = 200;   // Single dial position width
    this.lcdHeight = 100;   // LCD height
    this.artworkSize = 100; // Album art will be square, 100x100
    this.padding = 8;
    this.textColor = '#ffffff';
    this.backgroundColor = '#000000';
    this.accentColor = '#007bff'; // Progress bar color
  }

  /**
   * Extract base64 from data URL if needed
   */
  extractBase64FromDataUrl(dataUrl) {
    if (!dataUrl) return null;
    
    if (dataUrl.startsWith('data:')) {
      const base64 = dataUrl.split(',')[1];
      return Buffer.from(base64, 'base64');
    }
    
    // Assume it's already raw base64
    return Buffer.from(dataUrl, 'base64');
  }

  /**
   * Create a progress bar image with rounded rectangle (Spotify Green style)
   */
  async createProgressBar(duration, currentTime, barWidth, barX, barY) {
    const barHeight = 5;
    const radius = 1;
    const bgColor = '#404040';
    const fillColor = '#1DB954'; // Spotify Green

    if (!duration || duration === 0) {
      // No progress info - just background
      const svg = `
        <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${radius}" fill="${bgColor}"/>
        </svg>
      `;
      return Buffer.from(svg);
    }

    const progressWidth = Math.round((currentTime / duration) * barWidth);
    
    const svg = `
      <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${radius}" fill="${bgColor}"/>
        ${progressWidth > 0 ? `<rect x="${barX}" y="${barY}" width="${progressWidth}" height="${barHeight}" rx="${radius}" fill="${fillColor}"/>` : ''}
      </svg>
    `;

    return Buffer.from(svg);
  }

  /**
   * Render the complete 400x100 LCD image, then crop based on position
   * @param {Object} trackInfo - Track information
   * @param {string} position - 'left' or 'right' - which half to return
   */
  async render(trackInfo, position = 'left') {
    try {
      // Build the FULL 400x100 image first
      let composite = [];

      // LEFT SIDE: Album art (100x100, positioned at left)
      if (trackInfo.thumbnail) {
        try {
          const artBuffer = this.extractBase64FromDataUrl(trackInfo.thumbnail);
          if (artBuffer) {
            // Resize to 100x100
            const albumArtBuffer = await sharp(artBuffer)
              .resize(this.artworkSize, this.artworkSize, {
                fit: 'cover',
                position: 'center'
              })
              .png()
              .toBuffer();

            composite.push({
              input: albumArtBuffer,
              left: 0,
              top: 0
            });
          }
        } catch (error) {
          console.error('Error processing album art:', error);
        }
      }

      // RIGHT SIDE: Track info and progress bar (starting at x=100)
      const textX = 100 + this.padding;
      const textAreaWidth = this.fullWidth - textX - this.padding;

      // Build SVG for text content
      const svgText = this.buildTextSvg(trackInfo, textAreaWidth);
      const textBuffer = Buffer.from(svgText);

      composite.push({
        input: textBuffer,
        left: textX,
        top: 0
      });

      // Create the progress bar (rounded rectangle style)
      const barX = textX;
      const barY = 75;
      const barWidth = textAreaWidth - this.padding;
      const progressBuffer = await this.createProgressBar(
        trackInfo.duration,
        trackInfo.position,
        barWidth,
        barX,
        barY
      );

      composite.push({
        input: progressBuffer,
        left: 0,
        top: 0
      });

      // Create the FULL 400x100 canvas
      const fullCanvas = await sharp({
        create: {
          width: this.fullWidth,
          height: this.lcdHeight,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
        .composite(composite)
        .png()
        .toBuffer();

      // Now crop based on position
      const cropX = position === 'left' ? 0 : this.dialWidth;
      const croppedImage = await sharp(fullCanvas)
        .extract({
          left: cropX,
          top: 0,
          width: this.dialWidth,
          height: this.lcdHeight
        })
        .png()
        .toBuffer();

      // Convert to data URL
      return `data:image/png;base64,${croppedImage.toString('base64')}`;
    } catch (error) {
      console.error('Error rendering LCD screen:', error);
      // Return a minimal fallback
      return await this.createFallback(position);
    }
  }

  /**
   * Build SVG with text content (title, artist, album)
   */
  buildTextSvg(trackInfo, maxWidth) {
    const title = trackInfo.trackName || 'Unknown Track';
    const artist = Array.isArray(trackInfo.artist) 
      ? trackInfo.artist.join(', ') 
      : (trackInfo.artist || 'Unknown Artist');
    const album = trackInfo.album || '';

    const fontSize = 11;
    const lineHeight = 14;
    let yPos = 18;

    // Truncate text if needed
    const truncate = (text, maxChars = 45) => {
      return text.length > maxChars ? text.substring(0, maxChars - 3) + '...' : text;
    };

    const svg = `
    <svg width="280" height="100" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font-family: Arial, sans-serif; font-size: 20px; font-weight: normal; fill: white; }
        .artist { font-family: Arial, sans-serif; font-size: 16px; fill: #B3B3B3; }
      </style>
      <text x="0" y="27" class="title">${escapeXml(truncate(title, 28))}</text>
      <text x="0" y="55" class="artist">${escapeXml(truncate(artist, 32))}</text>
    </svg>
    `;

    return svg;
  }

  /**
   * Create a minimal fallback image for a single dial position
   * @param {string} position - 'left' or 'right'
   */
  async createFallback(position = 'left') {
    const message = position === 'left' ? '♪' : 'No Track';
    const fallbackSvg = `
    <svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="100" fill="black"/>
      <text x="100" y="55" font-family="Arial" font-size="${position === 'left' ? '40' : '14'}" fill="#666666" text-anchor="middle">
        ${message}
      </text>
    </svg>
    `;

    const buffer = Buffer.from(fallbackSvg);
    const result = await sharp(buffer).png().toBuffer();
    return `data:image/png;base64,${result.toString('base64')}`;
  }

  /**
   * Create an idle/no track playing image
   * @param {string} position - 'left' or 'right'
   */
  async createBlank(position = 'left') {
    try {
      let composite = [];

      // LEFT SIDE: Dark album art area with pause icon (100x100 at left)
      const darkArtSvg = `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="#1a1a1a"/>
        <!-- Pause icon overlay -->
        <rect x="35" y="35" width="10" height="30" fill="white" opacity="0.6"/>
        <rect x="55" y="35" width="10" height="30" fill="white" opacity="0.6"/>
      </svg>
      `;
      
      const darkArtBuffer = Buffer.from(darkArtSvg);
      composite.push({
        input: darkArtBuffer,
        left: 0,
        top: 0
      });

      // RIGHT SIDE: Text and empty progress bar - match the playing state layout exactly
      const textX = 100 + this.padding;
      const textAreaWidth = this.fullWidth - textX - this.padding;
      const barX = textX;
      const barWidth = textAreaWidth - this.padding;

      const textSvg = `
      <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <style>
          .title { font-family: Arial, sans-serif; font-size: 20px; font-weight: normal; fill: white; }
          .artist { font-family: Arial, sans-serif; font-size: 16px; fill: #B3B3B3; }
        </style>
        <text x="${textX}" y="27" class="title">No track playing</text>
        <text x="${textX}" y="55" class="artist">Start playing music</text>
        <!-- Empty progress bar background -->
        <rect x="${barX}" y="75" width="${barWidth}" height="5" rx="1" fill="#404040"/>
      </svg>
      `;

      const textBuffer = Buffer.from(textSvg);
      composite.push({
        input: textBuffer,
        left: 0,
        top: 0
      });

      // Create the FULL 400x100 canvas (same as render method)
      const fullCanvas = await sharp({
        create: {
          width: this.fullWidth,
          height: this.lcdHeight,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
        .composite(composite)
        .png()
        .toBuffer();

      // Crop based on position (same as render method)
      const cropX = position === 'left' ? 0 : this.dialWidth;
      const croppedImage = await sharp(fullCanvas)
        .extract({
          left: cropX,
          top: 0,
          width: this.dialWidth,
          height: this.lcdHeight
        })
        .png()
        .toBuffer();

      return `data:image/png;base64,${croppedImage.toString('base64')}`;
    } catch (error) {
      console.error('Error creating blank/idle image:', error);
      // Fallback to simple black
      const fallbackSvg = `
      <svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="100" fill="black"/>
      </svg>
      `;
      const buffer = Buffer.from(fallbackSvg);
      const result = await sharp(buffer).png().toBuffer();
      return `data:image/png;base64,${result.toString('base64')}`;
    }
  }
}

/**
 * Escape XML special characters for SVG text
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = NowPlayingRenderer;
