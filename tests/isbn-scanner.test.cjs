const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BarcodeFormat, DecodeHintType, MultiFormatOneDReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource, NotFoundException } = require("@zxing/library");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

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

// Exercise the scanner's event/effect flow with a camera and storage substitute.
function scanner(storage = new Map(), response = { isbn: "9781838919443", metadata: { title: "Book" } }) {
  const hooks = [], effects = [], transitions = [], calls = [];
  let cursor, decode, tree;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!hooks[index] || deps.some((value, i) => value !== hooks[index].deps[i])) {
        const previous = hooks[index];
        hooks[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); hooks[index].cleanup = effect(); });
      }
    },
    startTransition(callback) { transitions.push(callback()); },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const source = ts.transpileModule(readFileSync(resolve(__dirname, "../components/admin/isbn-scanner.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mocks = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { default: "a" },
    "@/lib/isbn": { canonicalIsbn: value => value },
    "@/app/admin/books/isbn-actions": {
      lookupBookIsbn: async () => { calls.push("lookup"); return response; },
      addIsbnDraft: async () => { calls.push("save"); return "metadata" in response ? { ...response, savedDraft: { id: "draft-id", title: "Book" } } : response; },
    },
    "@zxing/library": { BarcodeFormat, DecodeHintType },
    "@zxing/browser": { BrowserMultiFormatOneDReader: class {
      async decodeFromStream(_stream, _video, callback) { decode = callback; return { stop() {} }; }
    } },
  };
  vm.runInNewContext(source, {
    exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; },
    window: { isSecureContext: true },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    navigator: { mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [], getVideoTracks: () => [] }), enumerateDevices: async () => [],
    } },
  });
  const props = { disabled: false, onAccept: () => calls.push("accept"), onSaved: () => calls.push("saved"), onBusy() {}, onBlocked: value => calls.push(`blocked:${value}`), onManual() {} };
  function render() {
    cursor = 0; tree = exports.default(props);
    effects.splice(0).forEach(effect => effect());
    return tree;
  }
  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(child => nodes(child))];
  }
  render(); render();
  return {
    calls,
    toggle(enabled) { nodes(tree).find(node => node.type === "input").props.onChange({ target: { checked: enabled } }); render(); },
    checked: () => nodes(tree).find(node => node.type === "input").props.checked,
    async scan() {
      nodes(tree).find(node => node.type === "button" && node.props.children === "Scan barcode ISBN").props.onClick();
      render();
      await new Promise(resolve => setImmediate(resolve));
      const decoded = { getText: () => "9781838919443" }, controls = { stop() {} };
      decode(decoded, null, controls); decode(decoded, null, controls);
      await Promise.all(transitions);
      render();
    },
  };
}

test("auto-add defaults off, persists the toggle, and saves each scan once without accepting into the form", async () => {
  const storage = new Map();
  const manual = scanner(storage);
  assert.equal(manual.checked(), false);
  await manual.scan();
  assert.ok(manual.calls.includes("lookup"));
  assert.ok(manual.calls.includes("accept"));
  assert.ok(!manual.calls.includes("save"));
  manual.toggle(true);
  const automatic = scanner(storage);
  assert.equal(automatic.checked(), true);
  await automatic.scan();
  assert.equal(automatic.calls.filter(call => call === "save").length, 1);
  assert.ok(automatic.calls.includes("saved"));
  assert.ok(!automatic.calls.includes("accept"));
  assert.ok(automatic.calls.includes("blocked:true"));
  automatic.toggle(false);
  assert.equal(scanner(storage).checked(), false);
});

test("a rejected automatic scan blocks manual submission and never reports a saved draft", async () => {
  const automatic = scanner(new Map([["isbn-auto-add-draft", "true"]]), { error: "ISBN duplikat" });
  await automatic.scan();
  assert.ok(automatic.calls.includes("blocked:true"));
  assert.ok(!automatic.calls.includes("saved"));
  assert.ok(!automatic.calls.includes("accept"));
});
