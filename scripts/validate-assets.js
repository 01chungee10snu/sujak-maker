const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'assets/generated/asset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const sourceFiles = ['index.html', 'style.css', 'main.js', 'docs/yonggang-design.md']
  .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

function pngInfo(file) {
  const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  const width = Number((output.match(/pixelWidth:\s*(\d+)/) || [])[1]);
  const height = Number((output.match(/pixelHeight:\s*(\d+)/) || [])[1]);
  return { width, height };
}

const required = new Map([
  ['assets/generated/yonggang-mascot.png', { width: 1024, height: 1024 }],
  ['assets/generated/value-chain-sprites.png', { width: 1024, height: 768 }],
  ['assets/generated/factory-background.png', { width: 576, height: 1024 }]
]);

const failures = [];
for (const asset of manifest.assets) {
  const abs = path.join(root, asset.file);
  if (!fs.existsSync(abs)) {
    failures.push(`${asset.file} missing`);
    continue;
  }
  const stat = fs.statSync(abs);
  if (stat.size !== asset.bytes) failures.push(`${asset.file} manifest bytes ${asset.bytes}, actual ${stat.size}`);
  const expected = required.get(asset.file);
  if (!expected) failures.push(`${asset.file} unexpected manifest asset`);
  const info = pngInfo(abs);
  if (!info.width || !info.height) failures.push(`${asset.file} invalid PNG dimensions`);
  if (expected && (info.width !== expected.width || info.height !== expected.height)) {
    failures.push(`${asset.file} dimensions ${info.width}x${info.height}, expected ${expected.width}x${expected.height}`);
  }
  if (!sourceFiles.includes(asset.file)) {
    failures.push(`${asset.file} is not referenced by app/docs`);
  }
}
for (const [file] of required) {
  if (!manifest.assets.some(asset => asset.file === file)) failures.push(`${file} missing from manifest`);
}

if (!manifest.reference || !fs.existsSync(path.join(root, manifest.reference))) {
  failures.push('reference image missing from manifest reference');
}

if (!Array.isArray(manifest.prompts) || manifest.prompts.length < 3) {
  failures.push('manifest prompts missing');
} else {
  for (const promptFile of manifest.prompts) {
    if (!fs.existsSync(path.join(root, promptFile))) failures.push(`${promptFile} prompt missing`);
  }
}

if (!Array.isArray(manifest.componentSources) || manifest.componentSources.length !== 12) {
  failures.push('componentSources must contain 12 GPT-generated icon components');
} else {
  for (const component of manifest.componentSources) {
    const abs = path.join(root, component.file);
    if (!fs.existsSync(abs)) {
      failures.push(`${component.file} missing`);
      continue;
    }
    const stat = fs.statSync(abs);
    if (stat.size !== component.bytes) failures.push(`${component.file} manifest bytes ${component.bytes}, actual ${stat.size}`);
    const info = pngInfo(abs);
    if (info.width !== 1024 || info.height !== 1024) {
      failures.push(`${component.file} dimensions ${info.width}x${info.height}, expected 1024x1024`);
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`validated ${manifest.assets.length} generated assets and manifest entries`);
