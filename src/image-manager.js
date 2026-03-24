/**
 * ImageManager - Handles loading and drawing of pier images with crop/scale support
 */
export class ImageManager {
  constructor(p5Instance) {
    this.p = p5Instance;
    this.images = new Map(); // key: "round_cameraIndex" -> p5.Image
    this.manifest = null;
    this.config = null;
    this.loaded = false;
  }

  /**
   * Load manifest and config files
   */
  async loadManifest() {
    const [manifestRes, configRes] = await Promise.all([
      fetch("/manifest.json"),
      fetch("/config.json"),
    ]);

    this.manifest = await manifestRes.json();
    this.config = await configRes.json();

    console.log(
      `Manifest loaded: ${this.manifest.meta.totalImages} images across ${this.manifest.meta.rounds.length} rounds`
    );
    return this.manifest;
  }

  /**
   * Preload all images from the manifest
   * Call this in p5's preload() function
   */
  preloadImages() {
    if (!this.manifest) {
      console.error("Manifest not loaded. Call loadManifest() first.");
      return;
    }

    for (const imgData of this.manifest.images) {
      const key = this._getKey(imgData.round, imgData.cameraIndex);
      const img = this.p.loadImage(imgData.path);
      this.images.set(key, {
        image: img,
        ...imgData,
      });
    }

    this.loaded = true;
    console.log(`Preloaded ${this.images.size} images`);
  }

  /**
   * Get an image by round and camera index
   */
  getImage(round, cameraIndex) {
    const key = this._getKey(round, cameraIndex);
    return this.images.get(key);
  }

  /**
   * Get an image by round and angle (finds closest camera index)
   */
  getImageByAngle(round, angleDegrees) {
    const normalizedAngle = ((angleDegrees % 360) + 360) % 360;
    const cameraIndex = Math.round(
      normalizedAngle / this.manifest.meta.degreesPerImage
    ) % this.manifest.meta.imagesPerRound;
    return this.getImage(round, cameraIndex);
  }

  /**
   * Get all images at a specific elevation
   */
  getImagesByElevation(elevation) {
    const results = [];
    for (const [, imgData] of this.images) {
      if (imgData.elevation === elevation) {
        results.push(imgData);
      }
    }
    return results.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.cameraIndex - b.cameraIndex;
    });
  }

  /**
   * Get all images for a specific round
   */
  getImagesByRound(round) {
    const results = [];
    for (const [, imgData] of this.images) {
      if (imgData.round === round) {
        results.push(imgData);
      }
    }
    return results.sort((a, b) => a.cameraIndex - b.cameraIndex);
  }

  /**
   * Draw an image with crop and scale applied from config
   * @param {number} round - Round number
   * @param {number} cameraIndex - Camera index within the round
   * @param {number} x - X position to draw at
   * @param {number} y - Y position to draw at
   * @param {number} width - Target width (before scale)
   * @param {number} height - Target height (before scale)
   */
  drawImage(round, cameraIndex, x, y, width, height) {
    const imgData = this.getImage(round, cameraIndex);
    if (!imgData || !imgData.image) {
      console.warn(`Image not found: round=${round}, cameraIndex=${cameraIndex}`);
      return;
    }

    this._drawWithCrop(imgData.image, x, y, width, height);
  }

  /**
   * Draw an image by angle with crop and scale applied
   */
  drawImageByAngle(round, angleDegrees, x, y, width, height) {
    const imgData = this.getImageByAngle(round, angleDegrees);
    if (!imgData || !imgData.image) {
      console.warn(`Image not found: round=${round}, angle=${angleDegrees}`);
      return;
    }

    this._drawWithCrop(imgData.image, x, y, width, height);
  }

  /**
   * Draw an image by angle CENTERED at the given position
   * The image will be drawn with its center at (centerX, centerY)
   */
  drawImageByAngleCentered(round, angleDegrees, centerX, centerY, width, height) {
    const imgData = this.getImageByAngle(round, angleDegrees);
    if (!imgData || !imgData.image) {
      return;
    }

    this._drawWithCropCentered(imgData.image, centerX, centerY, width, height);
  }

  /**
   * Draw an image CENTERED at the given position
   */
  drawImageCentered(round, cameraIndex, centerX, centerY, width, height) {
    const imgData = this.getImage(round, cameraIndex);
    if (!imgData || !imgData.image) {
      return;
    }

    this._drawWithCropCentered(imgData.image, centerX, centerY, width, height);
  }

  /**
   * Internal: Draw image with crop applied, CENTERED at position
   */
  _drawWithCropCentered(img, centerX, centerY, targetWidth, targetHeight) {
    const { crop, scale } = this.config;
    const imgWidth = img.width;
    const imgHeight = img.height;

    // Calculate crop in pixels (normalized 0-1 values)
    const cropLeft = imgWidth * crop.left;
    const cropTop = imgHeight * crop.top;
    const cropRight = imgWidth * crop.right;
    const cropBottom = imgHeight * crop.bottom;

    // Source dimensions after crop
    const srcWidth = imgWidth - cropLeft - cropRight;
    const srcHeight = imgHeight - cropTop - cropBottom;

    // Apply config scale to target dimensions
    const scaledWidth = targetWidth * scale;
    const scaledHeight = targetHeight * scale;

    // Draw the cropped and scaled image CENTERED
    // p5's image() with imageMode(CENTER) draws from center
    this.p.image(
      img,
      centerX,
      centerY,
      scaledWidth,
      scaledHeight,
      cropLeft,
      cropTop,
      srcWidth,
      srcHeight
    );
  }

  /**
   * Draw an image by angle CENTERED to a specific graphics context
   */
  drawImageByAngleCenteredToGraphics(pg, round, angleDegrees, centerX, centerY, width, height) {
    const imgData = this.getImageByAngle(round, angleDegrees);
    if (!imgData || !imgData.image) return;

    this._drawWithCropCenteredToGraphics(pg, imgData.image, centerX, centerY, width, height);
  }

  /**
   * Internal: Draw image with crop applied, CENTERED, to a graphics context
   */
  _drawWithCropCenteredToGraphics(pg, img, centerX, centerY, targetWidth, targetHeight) {
    const { crop, scale } = this.config;
    const imgWidth = img.width;
    const imgHeight = img.height;

    const cropLeft = imgWidth * crop.left;
    const cropTop = imgHeight * crop.top;
    const cropRight = imgWidth * crop.right;
    const cropBottom = imgHeight * crop.bottom;

    const srcWidth = imgWidth - cropLeft - cropRight;
    const srcHeight = imgHeight - cropTop - cropBottom;

    const scaledWidth = targetWidth * scale;
    const scaledHeight = targetHeight * scale;

    pg.image(
      img,
      centerX,
      centerY,
      scaledWidth,
      scaledHeight,
      cropLeft,
      cropTop,
      srcWidth,
      srcHeight
    );
  }

  /**
   * Internal: Draw image with crop applied from config
   */
  _drawWithCrop(img, x, y, targetWidth, targetHeight) {
    const { crop, scale } = this.config;
    const imgWidth = img.width;
    const imgHeight = img.height;

    // Calculate crop in pixels (normalized 0-1 values)
    const cropLeft = imgWidth * crop.left;
    const cropTop = imgHeight * crop.top;
    const cropRight = imgWidth * crop.right;
    const cropBottom = imgHeight * crop.bottom;

    // Source dimensions after crop
    const srcWidth = imgWidth - cropLeft - cropRight;
    const srcHeight = imgHeight - cropTop - cropBottom;

    // Apply scale to target dimensions
    const scaledWidth = targetWidth * scale;
    const scaledHeight = targetHeight * scale;

    // Draw the cropped and scaled image
    this.p.image(
      img,
      x,
      y,
      scaledWidth,
      scaledHeight,
      cropLeft,
      cropTop,
      srcWidth,
      srcHeight
    );
  }

  /**
   * Get the crop-adjusted aspect ratio
   */
  getCroppedAspectRatio() {
    if (!this.config || this.images.size === 0) return 1;

    // Get first image to determine base dimensions
    const firstImg = this.images.values().next().value;
    if (!firstImg || !firstImg.image) return 1;

    const { crop } = this.config;
    const imgWidth = firstImg.image.width;
    const imgHeight = firstImg.image.height;

    const croppedWidth = imgWidth * (1 - crop.left - crop.right);
    const croppedHeight = imgHeight * (1 - crop.top - crop.bottom);

    return croppedWidth / croppedHeight;
  }

  /**
   * Internal: Generate map key
   */
  _getKey(round, cameraIndex) {
    return `${round}_${cameraIndex}`;
  }

  /**
   * Get all available rounds
   */
  getRounds() {
    return this.manifest?.meta.rounds || [];
  }

  /**
   * Get all available elevations
   */
  getElevations() {
    return this.manifest?.meta.elevations || [];
  }

  /**
   * Get total number of images
   */
  getTotalImages() {
    return this.images.size;
  }
}
