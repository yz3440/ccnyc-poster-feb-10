import { readdir, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const IMAGE_FOLDER = "pier_57_ortho_capture";
const IMAGES_PER_ROUND = 72;
const DEGREES_PER_IMAGE = 360 / IMAGES_PER_ROUND; // 5 degrees

// Regex to parse filename: rXXX_cXXXX_XXm.webp (supports negative elevations)
const FILENAME_REGEX = /^r(\d{3})_c(\d{4})_(-?\d+)m\.webp$/;

async function generateManifest() {
  const imageDir = join(PUBLIC_DIR, IMAGE_FOLDER);
  const outputPath = join(PUBLIC_DIR, "manifest.json");

  console.log(`Scanning images in: ${imageDir}`);

  // Read all files in the image directory
  const files = await readdir(imageDir);

  // Parse each filename and extract metadata
  const images = [];
  const roundsSet = new Set();
  const elevationsSet = new Set();

  for (const filename of files) {
    const match = filename.match(FILENAME_REGEX);
    if (!match) {
      console.warn(`Skipping file (doesn't match pattern): ${filename}`);
      continue;
    }

    const [, roundStr, cameraIndexStr, elevationStr] = match;
    const round = parseInt(roundStr, 10);
    const cameraIndex = parseInt(cameraIndexStr, 10);
    const elevation = parseInt(elevationStr, 10);
    const angle = cameraIndex * DEGREES_PER_IMAGE;

    images.push({
      filename,
      path: `${IMAGE_FOLDER}/${filename}`,
      round,
      cameraIndex,
      elevation,
      angle,
    });

    roundsSet.add(round);
    elevationsSet.add(elevation);
  }

  // Sort images by round, then by camera index
  images.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.cameraIndex - b.cameraIndex;
  });

  // Build manifest
  const manifest = {
    images,
    meta: {
      imagesPerRound: IMAGES_PER_ROUND,
      degreesPerImage: DEGREES_PER_IMAGE,
      rounds: Array.from(roundsSet).sort((a, b) => a - b),
      elevations: Array.from(elevationsSet).sort((a, b) => a - b),
      totalImages: images.length,
    },
  };

  await writeFile(outputPath, JSON.stringify(manifest, null, 2));

  console.log(`\nManifest generated: ${outputPath}`);
  console.log(`Total images: ${images.length}`);
  console.log(`Rounds: ${manifest.meta.rounds.join(", ")}`);
  console.log(`Elevations: ${manifest.meta.elevations.join("m, ")}m`);
}

generateManifest().catch(console.error);
