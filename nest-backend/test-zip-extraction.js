const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');

async function testZipExtraction() {
  // Test all three fixture files
  const testFiles = [
    'basic-example.elp',
    'encoding_test.elp',
    'tema-10-ejemplo.elp'
  ];

  for (const fileName of testFiles) {
    console.log('\n' + '='.repeat(70));
    console.log(`Testing: ${fileName}`);
    console.log('='.repeat(70));
    await testSingleFile(fileName);
  }
}

async function testSingleFile(fileName) {
  const elpFile = path.join(__dirname, 'test', 'fixtures', fileName);

  console.log('Testing ZIP extraction...');
  console.log('ELP file:', elpFile);
  console.log('File exists:', await fs.pathExists(elpFile));

  if (!(await fs.pathExists(elpFile))) {
    console.error('ELP file not found!');
    return;
  }

  // Check file size
  const stats = await fs.stat(elpFile);
  console.log('File size:', stats.size, 'bytes');

  // Load ZIP
  const zip = new AdmZip(elpFile);
  const entries = zip.getEntries();

  console.log('\nZIP Contents:');
  console.log('Total entries:', entries.length);

  // List all entries
  entries.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.isDirectory ? '[DIR]' : '[FILE]'} ${entry.entryName} (${entry.header.size} bytes, compressed: ${entry.header.compressedSize} bytes)`);
  });

  // Find content.xml
  const contentXmlEntry = zip.getEntry('content.xml');
  if (!contentXmlEntry) {
    console.error('\n❌ content.xml not found in ZIP!');
    return;
  }

  console.log('\n✓ content.xml found!');
  console.log('  Uncompressed size:', contentXmlEntry.header.size);
  console.log('  Compressed size:', contentXmlEntry.header.compressedSize);

  // Extract to buffer
  const buffer = contentXmlEntry.getData();
  console.log('  Extracted buffer length:', buffer.length);

  if (buffer.length === 0) {
    console.error('  ❌ Buffer is empty!');
  } else {
    console.log('  ✓ Buffer has data');
    const content = buffer.toString('utf-8');
    console.log('  First 200 chars:', content.substring(0, 200));
  }

  // Test extraction to file
  const tempDir = path.join(__dirname, 'temp-extract-test');
  await fs.ensureDir(tempDir);

  try {
    console.log('\nTesting file extraction...');

    // Method 1: Using getData()
    const filePath1 = path.join(tempDir, 'content-method1.xml');
    await fs.writeFile(filePath1, contentXmlEntry.getData());
    const size1 = (await fs.stat(filePath1)).size;
    console.log('Method 1 (getData + writeFile):', size1, 'bytes');

    // Method 2: Using extractAllTo
    const extractDir = path.join(tempDir, 'extracted');
    zip.extractAllTo(extractDir, true);
    const extractedPath = path.join(extractDir, 'content.xml');
    if (await fs.pathExists(extractedPath)) {
      const size2 = (await fs.stat(extractedPath)).size;
      console.log('Method 2 (extractAllTo):', size2, 'bytes');

      // Read content
      const content2 = await fs.readFile(extractedPath, 'utf-8');
      console.log('First 200 chars:', content2.substring(0, 200));
    } else {
      console.error('Method 2 failed: file not found after extraction');
    }

  } finally {
    await fs.remove(tempDir);
    console.log('\nCleanup done.');
  }
}

testZipExtraction().catch(console.error);
