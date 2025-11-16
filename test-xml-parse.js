const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
  cdataPropName: '__cdata',
  ignoreDeclaration: true,
  ignorePiTags: true,
  commentPropName: false,
  allowBooleanAttributes: true,
});

// Extract content.xml from the ELP file
const elpPath = path.join(__dirname, 'test', 'fixtures', 'basic-example.elp');
const zip = new AdmZip(elpPath);
const contentXml = zip.readAsText('content.xml');

console.log('XML Length:', contentXml.length);
console.log('First 200 chars:', contentXml.substring(0, 200));

// Parse the XML
const parsed = parser.parse(contentXml);

console.log('\nParsed object keys:', Object.keys(parsed));
console.log('\nHas ode:', !!parsed.ode);
console.log('Has exe_document:', !!parsed.exe_document);

if (parsed.ode) {
  console.log('\node object keys:', Object.keys(parsed.ode));
  if (parsed.ode.odeProperties) {
    console.log('odeProperties type:', Array.isArray(parsed.ode.odeProperties.odeProperty) ? 'array' : 'object');
    console.log('odeProperties count:', Array.isArray(parsed.ode.odeProperties.odeProperty) ? parsed.ode.odeProperties.odeProperty.length : 1);
  }
}
