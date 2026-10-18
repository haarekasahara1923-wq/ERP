// Icon generation script for PWA
// Run: node scripts/generate-icons.js

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const SOURCE_ICON = path.join(__dirname, '../public/icons/icon-source.jpg')
const OUTPUT_DIR = path.join(__dirname, '../public/icons')

async function generateIcons() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  console.log('Generating PWA icons from:', SOURCE_ICON)

  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`)
    await sharp(SOURCE_ICON)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png()
      .toFile(outputPath)
    console.log(`✓ Generated icon-${size}x${size}.png`)
  }

  // Also copy as the legacy 512 icon
  await sharp(SOURCE_ICON)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'icon-512.png'))

  // Also copy as logo.png & play-store-icon
  await sharp(SOURCE_ICON)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .png()
    .toFile(path.join(__dirname, '../public/logo.png'))

  await sharp(SOURCE_ICON)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'play-store-icon-512.png'))

  // Also generate Next.js app icons
  const appDir = path.join(__dirname, '../src/app')
  await sharp(SOURCE_ICON)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .png()
    .toFile(path.join(appDir, 'icon.png'))

  await sharp(SOURCE_ICON)
    .resize(180, 180, { fit: 'cover', position: 'center' })
    .png()
    .toFile(path.join(appDir, 'apple-icon.png'))

  console.log('\n✅ All PWA, Next.js, and public icons generated successfully!')
}

generateIcons().catch(console.error)
