const config = require('../src/config');

describe('config/index.js', () => {
  test('should export servers array', () => {
    expect(Array.isArray(config.servers)).toBe(true);
    expect(config.servers.length).toBeGreaterThan(0);
    expect(typeof config.servers[0]).toBe('string');
  });

  test('should export RLUSD_CURRENCY', () => {
    expect(typeof config.RLUSD_CURRENCY).toBe('string');
    expect(config.RLUSD_CURRENCY).toMatch(/^[0-9A-F]{40}$/); // 40 character hex
  });

  test('should export RLUSD_ISSUER', () => {
    expect(typeof config.RLUSD_ISSUER).toBe('string');
    expect(config.RLUSD_ISSUER).toMatch(/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/); // Valid XRPL address format
  });

  test('should export ORACLE_ACCOUNT', () => {
    expect(typeof config.ORACLE_ACCOUNT).toBe('string');
    expect(config.ORACLE_ACCOUNT).toMatch(/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/); // Valid XRPL address format
  });
});