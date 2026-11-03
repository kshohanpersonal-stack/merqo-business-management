import { describe, it, expect } from 'vitest';
import {
  generateTestKeyPair,
  createLicensePayload,
  signLicense,
  verifyLicense,
  deviceMatch,
  canonicalPayload,
} from '../../src/core/licensing';

const device = JSON.stringify({ machine: 'm1', disk: 'd1', cpu: 'c1', user: 'u1' });
function fixture() {
  const keys = generateTestKeyPair();
  const payload = createLicensePayload({ businessName: 'মেসার্স রহিম ট্রেডার্স', deviceFingerprint: device });
  const file = signLicense(payload, keys.privateKey);
  return { keys, payload, file };
}
describe('TC-005 Ed25519 offline licence verification', () => {
  it('accepts a correctly signed lifetime licence on the matching device', () => {
    const { keys, file } = fixture();
    const r = verifyLicense(JSON.stringify(file), keys.publicKey, { currentDevice: device });
    expect(r.valid).toBe(true);
    expect(r.payload?.licenseType).toBe('LIFETIME');
    expect(r.payload?.businessName).toBe('মেসার্স রহিম ট্রেডার্স');
  });
  it('rejects a tampered business name, signature and wrong product', () => {
    const { keys, file } = fixture();
    const tampered = { ...file, payload: { ...file.payload, businessName: 'অন্য ব্যবসা' } };
    expect(verifyLicense(JSON.stringify(tampered), keys.publicKey, { currentDevice: device }).valid).toBe(
      false,
    );
    const wrongSig = { ...file, signature: Buffer.from('bad').toString('base64') };
    expect(verifyLicense(JSON.stringify(wrongSig), keys.publicKey, { currentDevice: device }).valid).toBe(
      false,
    );
    const wrongProduct = { ...file, payload: { ...file.payload, productId: 'OTHER' } };
    expect(verifyLicense(JSON.stringify(wrongProduct), keys.publicKey, { currentDevice: device }).valid).toBe(
      false,
    );
  });
  it('rejects a licence signed with a different private key', () => {
    const a = fixture();
    const b = generateTestKeyPair();
    expect(verifyLicense(JSON.stringify(a.file), b.publicKey, { currentDevice: device }).valid).toBe(false);
  });
  it('rejects device mismatch but tolerates one changed hardware component', () => {
    const { keys, file } = fixture();
    const wrong = JSON.stringify({ machine: 'x', disk: 'y', cpu: 'z', user: 'w' });
    expect(verifyLicense(JSON.stringify(file), keys.publicKey, { currentDevice: wrong }).valid).toBe(false);
    const oneChanged = JSON.stringify({ machine: 'm1', disk: 'CHANGED', cpu: 'c1', user: 'u1' });
    expect(deviceMatch(device, oneChanged).matched).toBe(true);
    expect(verifyLicense(JSON.stringify(file), keys.publicKey, { currentDevice: oneChanged }).valid).toBe(
      true,
    );
  });
  it('requires the signed business name, not just a matching user input', () => {
    const { keys, payload } = fixture();
    const forged = {
      ...signLicense({ ...payload, businessName: 'ভুয়া নাম' }, generateTestKeyPair().privateKey),
    };
    expect(verifyLicense(JSON.stringify(forged), keys.publicKey, { currentDevice: device }).valid).toBe(
      false,
    );
    expect(canonicalPayload(payload)).toContain('মেসার্স রহিম ট্রেডার্স');
  });
});
