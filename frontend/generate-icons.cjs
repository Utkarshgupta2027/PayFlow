/**
 * generate-icons.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time script to generate PWA icons from the source app logo.
 *
 * Input:  src/ChatGPT Image Jun 27, 2026, 10_50_24 PM.png
 * Output: public/icon-192.png  (192×192)
 *         public/icon-512.png  (512×512)
 *
 * Run:  node generate-icons.cjs
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

// ── Paths ─────────────────────────────────────────────────────────────────────
const SOURCE  = path.resolve(__dirname, 'src', 'ChatGPT Image Jun 27, 2026, 10_50_24 PM.png');
const OUT_DIR = path.resolve(__dirname, 'public');

// Ensure public/ exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function generateIcons() {
  console.log('🎨 Generating PWA icons from:', SOURCE);

  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  ];

  for (const { size, name } of sizes) {
    const dest = path.join(OUT_DIR, name);
    await sharp(SOURCE)
      .resize(size, size, {
        fit: 'cover',          // Fill the square — best for maskable icons
        position: 'centre',
      })
      .png({ quality: 95, compressionLevel: 8 })
      .toFile(dest);

    console.log(`  ✓ Generated ${name} (${size}×${size}px) → ${dest}`);
  }

  console.log('\n✅ All PWA icons generated successfully!');
  console.log('   Verify them at:');
  sizes.forEach(({ name }) => console.log(`   • public/${name}`));
}

generateIcons().catch((err) => {
  console.error('❌ Icon generation failed:', err.message);
  process.exit(1);
});
