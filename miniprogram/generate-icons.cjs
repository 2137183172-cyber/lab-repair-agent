// Generate simple placeholder tab bar icons for WeChat miniprogram
const fs = require('fs');
const zlib = require('zlib');

function createPNG(width, height, r, g, b, alpha) {
  // Create raw RGBA pixel data
  const rawData = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y++) {
    // Filter byte: 0 (None) for each row
    rawData[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      // Simple circle icon - colored circle on transparent bg
      const cx = width / 2, cy = height / 2, radius = width * 0.3;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        rawData[offset] = r;     // R
        rawData[offset + 1] = g; // G
        rawData[offset + 2] = b; // B
        rawData[offset + 3] = alpha; // A
      } else {
        rawData[offset] = 0;
        rawData[offset + 1] = 0;
        rawData[offset + 2] = 0;
        rawData[offset + 3] = 0;
      }
    }
  }

  // Compress with zlib
  const compressed = zlib.deflateSync(rawData);

  // Build PNG
  function crc32(buf) {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeB, data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([len, typeB, data, crcVal]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const size = 81; // WeChat recommended tab icon size

const icons = [
  { name: 'home', r: 153, g: 153, b: 153, a: 255 },        // gray (inactive)
  { name: 'home-active', r: 22, g: 119, b: 255, a: 255 },    // blue #1677FF (active)
  { name: 'order', r: 153, g: 153, b: 153, a: 255 },         // gray
  { name: 'order-active', r: 22, g: 119, b: 255, a: 255 },   // blue
  { name: 'mine', r: 153, g: 153, b: 153, a: 255 },          // gray
  { name: 'mine-active', r: 22, g: 119, b: 255, a: 255 },    // blue
  // Feature icons
  { name: 'scan', r: 34, g: 197, b: 94, a: 255 },           // green
  { name: 'report', r: 255, g: 152, b: 0, a: 255 },          // orange
  { name: 'tracking', r: 22, g: 119, b: 255, a: 255 },       // blue
  { name: 'device', r: 144, g: 19, b: 254, a: 255 },         // purple
  { name: 'avatar-default', r: 204, g: 204, b: 204, a: 255, size: 200 }, // light gray, larger
];

const dirs = [
  'src/static/icons',
  'dist/build/mp-weixin/static/icons',
];

for (const dir of dirs) {
  const fullDir = __dirname + '/' + dir;
  if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
  for (const icon of icons) {
    const iconSize = icon.size || size;
    const png = createPNG(iconSize, iconSize, icon.r, icon.g, icon.b, icon.a);
    fs.writeFileSync(fullDir + '/' + icon.name + '.png', png);
    console.log('Created: ' + dir + '/' + icon.name + '.png');
  }
}

console.log('\nDone! All icons generated.');
