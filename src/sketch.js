import p5 from "p5";
import { Pane } from "tweakpane";
import { ImageManager } from "./image-manager.js";

// Poster dimensions (Instagram story / portrait format)
const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1920;

let imageManager;
let isReady = false;

// Graphics buffers for trail effect
let trailBuffer;

// Tweakpane parameters
const PARAMS = {
  gridCols: 12,
  gridRows: 12,
  marginTop: -200,
  marginRight: -200,
  marginBottom: -200,
  marginLeft: -200,
  imageSize: 500,
  imageScale: 3.0,
  rotationSpeed: 1.0,
  phaseOffset: 30,
  phaseDirection: 'diagonal',
  trailDecay: 0.50,
  round: 7,
};

let pane;

const sketch = (p) => {
  imageManager = new ImageManager(p);

  p.preload = async () => {
    await imageManager.loadManifest();
    imageManager.preloadImages();
  };

  p.setup = () => {
    const canvas = p.createCanvas(POSTER_WIDTH, POSTER_HEIGHT);
    canvas.parent("canvas-container");

    // Scale canvas to fit viewport
    const maxHeight = window.innerHeight * 0.85;
    const scale = Math.min(1, maxHeight / POSTER_HEIGHT);
    canvas.style("width", `${POSTER_WIDTH * scale}px`);
    canvas.style("height", `${POSTER_HEIGHT * scale}px`);

    p.pixelDensity(1);
    p.frameRate(60);
    p.imageMode(p.CENTER);

    trailBuffer = p.createGraphics(POSTER_WIDTH, POSTER_HEIGHT);
    trailBuffer.imageMode(p.CENTER);

    setupTweakpane();
    isReady = true;
    console.log("Setup complete. Canvas:", POSTER_WIDTH, "x", POSTER_HEIGHT);
  };

  p.draw = () => {
    if (!isReady || !imageManager.loaded) return;

    // Step 1: Fade the trail buffer by drawing a semi-transparent rect
    trailBuffer.noStroke();
    trailBuffer.fill(20, 20, 20, 255 * (1 - PARAMS.trailDecay));
    trailBuffer.rect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
    
    // Step 2: Draw current frame images directly to trail buffer
    drawImageGrid(trailBuffer);

    p.background(20);
    p.image(trailBuffer, POSTER_WIDTH / 2, POSTER_HEIGHT / 2);
  };

  p.windowResized = () => {
    const maxHeight = window.innerHeight * 0.85;
    const scale = Math.min(1, maxHeight / POSTER_HEIGHT);
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.style.width = `${POSTER_WIDTH * scale}px`;
      canvas.style.height = `${POSTER_HEIGHT * scale}px`;
    }
  };
};

function setupTweakpane() {
  pane = new Pane({ title: 'Poster Controls' });
  
  const gridFolder = pane.addFolder({ title: 'Grid' });
  gridFolder.addBinding(PARAMS, 'gridCols', { min: 1, max: 12, step: 1, label: 'Columns' });
  gridFolder.addBinding(PARAMS, 'gridRows', { min: 1, max: 12, step: 1, label: 'Rows' });
  
  const marginFolder = pane.addFolder({ title: 'Margins' });
  marginFolder.addBinding(PARAMS, 'marginTop', { min: -200, max: 600, step: 10, label: 'Top' });
  marginFolder.addBinding(PARAMS, 'marginRight', { min: -200, max: 300, step: 10, label: 'Right' });
  marginFolder.addBinding(PARAMS, 'marginBottom', { min: -200, max: 600, step: 10, label: 'Bottom' });
  marginFolder.addBinding(PARAMS, 'marginLeft', { min: -200, max: 300, step: 10, label: 'Left' });
  
  const imageFolder = pane.addFolder({ title: 'Images' });
  imageFolder.addBinding(PARAMS, 'imageSize', { min: 50, max: 500, step: 10, label: 'Size' });
  imageFolder.addBinding(PARAMS, 'imageScale', { min: 0.1, max: 3.0, step: 0.1, label: 'Scale' });
  imageFolder.addBinding(PARAMS, 'round', { min: 0, max: 14, step: 1, label: 'Round (Elevation)' });
  
  const animFolder = pane.addFolder({ title: 'Animation' });
  animFolder.addBinding(PARAMS, 'rotationSpeed', { min: 0, max: 5, step: 0.1, label: 'Speed' });
  animFolder.addBinding(PARAMS, 'phaseOffset', { min: 0, max: 180, step: 5, label: 'Phase Offset' });
  animFolder.addBinding(PARAMS, 'phaseDirection', { 
    options: { 'Row': 'row', 'Column': 'col', 'Diagonal': 'diagonal', 'Radial': 'radial' },
    label: 'Phase Direction'
  });
  
  const trailFolder = pane.addFolder({ title: 'Trail Effect' });
  trailFolder.addBinding(PARAMS, 'trailDecay', { min: 0.5, max: 0.99, step: 0.01, label: 'Trail Persistence' });
}

function calculatePhaseOffset(row, col, totalRows, totalCols) {
  const { phaseOffset, phaseDirection } = PARAMS;
  
  switch (phaseDirection) {
    case 'row': return col * phaseOffset;
    case 'col': return row * phaseOffset;
    case 'diagonal': return (row + col) * phaseOffset;
    case 'radial':
      const centerRow = (totalRows - 1) / 2;
      const centerCol = (totalCols - 1) / 2;
      const distance = Math.sqrt(Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2));
      return distance * phaseOffset;
    default: return 0;
  }
}

function drawImageGrid(pg) {
  const { 
    gridCols, gridRows, 
    marginTop, marginRight, marginBottom, marginLeft,
    imageSize, imageScale,
    round, rotationSpeed
  } = PARAMS;
  
  const availableWidth = POSTER_WIDTH - marginLeft - marginRight;
  const availableHeight = POSTER_HEIGHT - marginTop - marginBottom;
  
  const cellWidth = availableWidth / gridCols;
  const cellHeight = availableHeight / gridRows;
  
  // Access frameCount from the main p5 instance
  const frameCount = pg._pInst ? pg._pInst.frameCount : pg.frameCount;
  const baseAngle = (frameCount * rotationSpeed * 2) % 360;
  
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const centerX = marginLeft + (col + 0.5) * cellWidth;
      const centerY = marginTop + (row + 0.5) * cellHeight;
      
      const phaseOff = calculatePhaseOffset(row, col, gridRows, gridCols);
      const angle = (baseAngle + phaseOff) % 360;
      
      const drawSize = imageSize * imageScale;
      
      imageManager.drawImageByAngleCenteredToGraphics(
        pg,
        round, 
        angle, 
        centerX, 
        centerY, 
        drawSize, 
        drawSize
      );
    }
  }
}

// Exports
export function drawPierImage(round, cameraIndex, x, y, w, h) {
  if (imageManager?.loaded) imageManager.drawImage(round, cameraIndex, x, y, w, h);
}

export function drawPierByAngle(round, angle, x, y, w, h) {
  if (imageManager?.loaded) imageManager.drawImageByAngle(round, angle, x, y, w, h);
}

export function getImageManager() { return imageManager; }
export const DIMENSIONS = { width: POSTER_WIDTH, height: POSTER_HEIGHT };
export function getParams() { return PARAMS; }

new p5(sketch);
