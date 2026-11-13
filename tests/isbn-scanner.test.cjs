const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BarcodeFormat, DecodeHintType, MultiFormatOneDReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource, NotFoundException } = require("@zxing/library");

function bitmap(matrix, width = 400, height = 160) {
  const pixels = new Uint8ClampedArray(width * height).fill(255);
  if (matrix) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    pixels[y * width + x] = matrix.get(x, y) ? 0 : 255;
  }
  return new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height)));
}

test("ISBN 1D reader retries blank frames without warnings and then reads EAN-13", () => {
  const reader = new MultiFormatOneDReader(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]]]));
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    for (let i = 0; i < 3; i++) assert.throws(() => reader.decode(bitmap()), NotFoundException);
    // Fixed EAN-13 fixture for 9781838919443, with quiet zones and 3px bars.
    const bars = ["101", "0111011", "0001001", "0110011", "0110111", "0100001", "0110111", "01010", "1110100", "1100110", "1110100", "1011100", "1011100", "1000010", "101"].join("");
    const matrix = { get: (x, y) => y >= 20 && y < 140 && bars[Math.floor((x - 40) / 3)] === "1" };
    assert.equal(reader.decode(bitmap(matrix)).getText(), "9781838919443");
    assert.equal(warnings.length, 0);
  } finally { console.warn = original; }
});
