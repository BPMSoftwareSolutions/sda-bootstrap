"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const CONTRACT_ROOT = path.join(
  REPOSITORY_ROOT,
  "capabilities",
  "sda-platform",
  "source-observation",
  "contracts"
);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, value] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const content = Buffer.from(value, "utf8");
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + content.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function minimalDocx(text) {
  return storedZip([
    ["[Content_Types].xml", "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>"],
    ["_rels/.rels", "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>"],
    ["word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`]
  ]);
}

function minimalPdf(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

test("the reference text provider emits schema-admitted observation and digest-only evidence", async () => {
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const { NodeTextSourceObservationProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-text-source-observation-provider.js"
  );
  const admission = new AjvSchemaAdmission(CONTRACT_ROOT);
  const sourceEnvelope = {
    fileName: "source.txt",
    mediaType: "text/plain",
    contentBase64: Buffer.from("alpha\nbeta", "utf8").toString("base64")
  };
  assert.equal(
    admission.validate(sourceEnvelope, "ui-file-source-envelope.v1.schema.json").valid,
    true
  );

  const provider = new NodeTextSourceObservationProvider();
  assert.deepEqual(provider.admit(JSON.stringify(sourceEnvelope)), {
    disposition: "SUPPORTED",
    sourceType: "ui-file-source-envelope.v1",
    mediaType: "text/plain"
  });
  const resolution = await provider.observe({
    sourceRole: "selected-document",
    sourceValue: JSON.stringify(sourceEnvelope)
  });

  assert.equal(
    admission.validate(resolution.observation, "consumer-source-observation.v1.schema.json").valid,
    true
  );
  assert.equal(
    admission.validate(resolution.evidence, "consumer-source-observation-evidence.v1.schema.json").valid,
    true
  );
  assert.equal(resolution.observation.text, "alpha\nbeta");
  assert.equal(Object.prototype.hasOwnProperty.call(resolution.evidence, "text"), false);
  assert.equal(resolution.observation.contentDigest, resolution.evidence.contentDigest);
});

test("the reference provider distinguishes ordinary values, malformed envelopes, and unsupported media", async () => {
  const { NodeTextSourceObservationProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-text-source-observation-provider.js"
  );
  const provider = new NodeTextSourceObservationProvider();

  assert.deepEqual(provider.admit("ordinary text value"), { disposition: "NOT_APPLICABLE" });
  assert.equal(provider.admit(JSON.stringify({ fileName: "missing-fields" })).code, "SOURCE_OBSERVATION_ENVELOPE_INVALID");
  assert.equal(provider.admit(JSON.stringify({
    fileName: "source.txt",
    mediaType: "text/plain",
    contentBase64: "",
    undeclared: true
  })).code, "SOURCE_OBSERVATION_ENVELOPE_INVALID");
  assert.equal(provider.admit(JSON.stringify({
    fileName: "source.bin",
    mediaType: "application/octet-stream",
    contentBase64: Buffer.from([0, 1]).toString("base64")
  })).code, "SOURCE_OBSERVATION_MEDIA_TYPE_NOT_SUPPORTED");
});

test("the reference provider admits an empty UTF-8 text file", async () => {
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const { NodeTextSourceObservationProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-text-source-observation-provider.js"
  );
  const sourceEnvelope = {
    fileName: "empty.txt",
    mediaType: "text/plain",
    contentBase64: ""
  };
  const admission = new AjvSchemaAdmission(CONTRACT_ROOT);
  assert.equal(admission.validate(sourceEnvelope, "ui-file-source-envelope.v1.schema.json").valid, true);

  const resolution = await new NodeTextSourceObservationProvider().observe({
    sourceRole: "selected-document",
    sourceValue: JSON.stringify(sourceEnvelope)
  });
  assert.equal(resolution.observation.byteLength, 0);
  assert.equal(resolution.observation.text, "");
  assert.equal(resolution.observation.contentDigest, "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("the independent document provider observes DOCX and PDF as consumer-neutral text", async () => {
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const { NodeDocumentTextSourceObservationProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-document-text-source-observation-provider.js"
  );
  const admission = new AjvSchemaAdmission(CONTRACT_ROOT);
  const provider = new NodeDocumentTextSourceObservationProvider();
  const sources = [
    {
      fileName: "candidate.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      contentBase64: minimalDocx("DOCX source observation").toString("base64"),
      expected: "DOCX source observation"
    },
    {
      fileName: "candidate.pdf",
      mediaType: "application/pdf",
      contentBase64: minimalPdf("PDF source observation").toString("base64"),
      expected: "PDF source observation"
    }
  ];

  for (const source of sources) {
    const sourceEnvelope = {
      fileName: source.fileName,
      mediaType: source.mediaType,
      contentBase64: source.contentBase64
    };
    assert.equal(provider.admit(JSON.stringify(sourceEnvelope)).disposition, "SUPPORTED");
    const resolution = await provider.observe({
      sourceRole: "candidate-document",
      sourceValue: JSON.stringify(sourceEnvelope)
    });
    assert.equal(admission.validate(resolution.observation, "consumer-source-observation.v1.schema.json").valid, true);
    assert.equal(admission.validate(resolution.evidence, "consumer-source-observation-evidence.v1.schema.json").valid, true);
    assert.match(resolution.observation.text, new RegExp(source.expected));
    assert.equal(resolution.evidence.providerId, "sda-node-document-text-source-observation.v1");
    assert.equal(Object.prototype.hasOwnProperty.call(resolution.evidence, "text"), false);
  }
});

test("document observation is media-type admitted and fails closed on malformed documents", async () => {
  const { NodeDocumentTextSourceObservationProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-document-text-source-observation-provider.js"
  );
  const provider = new NodeDocumentTextSourceObservationProvider();
  assert.deepEqual(provider.admit("ordinary text"), { disposition: "NOT_APPLICABLE" });
  assert.deepEqual(provider.admit(JSON.stringify({
    fileName: "source.txt",
    mediaType: "text/plain",
    contentBase64: Buffer.from("value").toString("base64")
  })), { disposition: "NOT_APPLICABLE" });
  await assert.rejects(provider.observe({
    sourceRole: "candidate-document",
    sourceValue: JSON.stringify({
      fileName: "broken.pdf",
      mediaType: "application/pdf",
      contentBase64: Buffer.from("not a pdf").toString("base64")
    })
  }), /SOURCE_OBSERVATION_DOCUMENT_DECODING_FAILED/);
});
