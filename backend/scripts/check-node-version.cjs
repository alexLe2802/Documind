const [major, minor] = process.versions.node.split('.').map(Number);

if (major !== 22 || minor < 12) {
  console.error(
    `Node.js >=22.12.0 <23 is required. Current version: ${process.versions.node}.`,
  );
  console.error('Run `nvm use` from the repository root, then retry.');
  process.exit(1);
}
