const [major, minor] = process.versions.node.split('.').map(Number);

if (major < 22 || (major === 22 && minor < 12)) {
  console.error(
    `Node.js 22.12+ is required. Current version: ${process.versions.node}.`,
  );
  console.error('Install Node.js 22 LTS, then reopen your terminal.');
  process.exit(1);
}
