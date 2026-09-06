#!/usr/bin/env python3
"""Verify Chrome's CRX3 developer signature, extension ID and ZIP contents.

Format: Chromium components/crx_file/crx3.proto and crx_creator.cc.
Only the length-delimited fields used by a developer-signed CRX3 are accepted.
"""
import hashlib
import io
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import zipfile

def varint(data, pos):
    value = shift = 0
    while pos < len(data) and shift < 64:
        byte = data[pos]
        pos += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, pos
        shift += 7
    raise ValueError('Invalid protobuf varint')

def fields(data):
    result, pos = {}, 0
    while pos < len(data):
        tag, pos = varint(data, pos)
        if tag & 7 != 2:
            raise ValueError('Unsupported CRX header field')
        length, pos = varint(data, pos)
        if pos + length > len(data):
            raise ValueError('Truncated CRX header field')
        result.setdefault(tag >> 3, []).append(data[pos:pos+length])
        pos += length
    return result

def verify(path):
    data = Path(path).read_bytes()
    if len(data) < 12 or data[:4] != b'Cr24':
        raise ValueError('Not a CRX file')
    version, size = struct.unpack('<II', data[4:12])
    if version != 3 or size > 1024 * 1024 or 12 + size >= len(data):
        raise ValueError('Invalid CRX3 header')
    header = fields(data[12:12+size])
    proof = fields(header[2][0])
    public_key, signature = proof[1][0], proof[2][0]
    signed = header[10000][0]
    identifier = fields(signed)[1][0]
    if len(identifier) != 16 or identifier != hashlib.sha256(public_key).digest()[:16]:
        raise ValueError('CRX ID does not match public key')
    archive = data[12+size:]
    signed_bytes = b'CRX3 SignedData\x00' + struct.pack('<I', len(signed)) + signed + archive
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        (root / 'key.der').write_bytes(public_key)
        (root / 'signature').write_bytes(signature)
        (root / 'signed').write_bytes(signed_bytes)
        subprocess.run(['openssl','pkey','-pubin','-inform','DER','-in',str(root/'key.der'),
                        '-out',str(root/'key.pem')], check=True, capture_output=True)
        subprocess.run(['openssl','dgst','-sha256','-verify',str(root/'key.pem'),
                        '-signature',str(root/'signature'),str(root/'signed')],
                       check=True, capture_output=True)
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_file:
        names = zip_file.namelist()
        if set(names) != {'manifest.json','policy.js','main.js','panel.js'} or len(names) != 4:
            raise ValueError('Unexpected extension archive files')
        if zip_file.testzip() is not None:
            raise ValueError('ZIP CRC failure')
        manifest = json.loads(zip_file.read('manifest.json'))
    return {'format':'CRX3', 'extension_id': ''.join(chr(97+int(c,16)) for c in identifier.hex()),
            'version':manifest['version'], 'files':names, 'signature':'verified'}

if __name__ == '__main__':
    import sys
    print(json.dumps(verify(sys.argv[1]), ensure_ascii=False, indent=2))
