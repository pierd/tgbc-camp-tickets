import { describe, it, expect } from '@jest/globals';
import { CampState, campStateDisplayName, isSameCountry } from '../src/states';

describe('CampState', () => {
  it('should have all Australian states', () => {
    const australianStates = [
      CampState.auNSW, CampState.auVIC, CampState.auQLD, CampState.auSA,
      CampState.auTAS, CampState.auACT, CampState.auNT, CampState.auWA
    ];

    australianStates.forEach(state => {
      expect(state).toMatch(/^au[A-Z]{2,3}$/);
    });
  });

  it('should have all US states', () => {
    const usStates = [
      CampState.usAK, CampState.usAZ, CampState.usCA, CampState.usFL,
      CampState.usGA, CampState.usHI, CampState.usID, CampState.usIL,
      CampState.usIN, CampState.usIA, CampState.usKY, CampState.usLA,
      CampState.usMD, CampState.usMI, CampState.usMN, CampState.usMO,
      CampState.usMS, CampState.usMT, CampState.usNC, CampState.usND,
      CampState.usNE, CampState.usNH, CampState.usNJ, CampState.usNM,
      CampState.usNV, CampState.usNY, CampState.usOH, CampState.usOK,
      CampState.usOR, CampState.usPA, CampState.usRI, CampState.usSC,
      CampState.usSD, CampState.usTN, CampState.usTX, CampState.usUT,
      CampState.usVA, CampState.usWA, CampState.usWV, CampState.usWI,
      CampState.usWY
    ];

    usStates.forEach(state => {
      expect(state).toMatch(/^us[A-Z]{2}$/);
    });
  });
});

describe('campStateDisplayName', () => {
  it('should have display names for all Australian states', () => {
    expect(campStateDisplayName[CampState.auNSW]).toBe('New South Wales');
    expect(campStateDisplayName[CampState.auVIC]).toBe('Victoria');
    expect(campStateDisplayName[CampState.auQLD]).toBe('Queensland');
    expect(campStateDisplayName[CampState.auSA]).toBe('South Australia');
    expect(campStateDisplayName[CampState.auTAS]).toBe('Tasmania');
    expect(campStateDisplayName[CampState.auACT]).toBe('Australian Capital Territory');
    expect(campStateDisplayName[CampState.auNT]).toBe('Northern Territory');
    expect(campStateDisplayName[CampState.auWA]).toBe('Western Australia');
  });

  it('should have display names for all US states', () => {
    expect(campStateDisplayName[CampState.usAK]).toBe('Alaska');
    expect(campStateDisplayName[CampState.usCA]).toBe('California');
    expect(campStateDisplayName[CampState.usFL]).toBe('Florida');
    expect(campStateDisplayName[CampState.usNY]).toBe('New York');
    expect(campStateDisplayName[CampState.usTX]).toBe('Texas');
    expect(campStateDisplayName[CampState.usWA]).toBe('Washington');
  });

  it('should have a display name for every CampState enum value', () => {
    Object.values(CampState).forEach(state => {
      expect(campStateDisplayName[state]).toBeDefined();
      expect(typeof campStateDisplayName[state]).toBe('string');
      expect(campStateDisplayName[state].length).toBeGreaterThan(0);
    });
  });
});

describe('isSameCountry', () => {
  it('should return true for states in the same country', () => {
    // Australian states
    expect(isSameCountry(CampState.auNSW, CampState.auVIC)).toBe(true);
    expect(isSameCountry(CampState.auQLD, CampState.auWA)).toBe(true);
    expect(isSameCountry(CampState.auACT, CampState.auNT)).toBe(true);

    // US states
    expect(isSameCountry(CampState.usCA, CampState.usNY)).toBe(true);
    expect(isSameCountry(CampState.usTX, CampState.usFL)).toBe(true);
    expect(isSameCountry(CampState.usAK, CampState.usHI)).toBe(true);
  });

  it('should return false for states in different countries', () => {
    expect(isSameCountry(CampState.auNSW, CampState.usCA)).toBe(false);
    expect(isSameCountry(CampState.auVIC, CampState.usNY)).toBe(false);
    expect(isSameCountry(CampState.auQLD, CampState.usTX)).toBe(false);
    expect(isSameCountry(CampState.auWA, CampState.usFL)).toBe(false);
  });

  it('should return true for the same state', () => {
    expect(isSameCountry(CampState.auNSW, CampState.auNSW)).toBe(true);
    expect(isSameCountry(CampState.usCA, CampState.usCA)).toBe(true);
    expect(isSameCountry(CampState.auVIC, CampState.auVIC)).toBe(true);
  });

  it('should work with all state combinations', () => {
    const australianStates = [
      CampState.auNSW, CampState.auVIC, CampState.auQLD, CampState.auSA,
      CampState.auTAS, CampState.auACT, CampState.auNT, CampState.auWA
    ];

    const usStates = [
      CampState.usAK, CampState.usAZ, CampState.usCA, CampState.usFL,
      CampState.usGA, CampState.usHI, CampState.usID, CampState.usIL,
      CampState.usIN, CampState.usIA, CampState.usKY, CampState.usLA,
      CampState.usMD, CampState.usMI, CampState.usMN, CampState.usMO,
      CampState.usMS, CampState.usMT, CampState.usNC, CampState.usND,
      CampState.usNE, CampState.usNH, CampState.usNJ, CampState.usNM,
      CampState.usNV, CampState.usNY, CampState.usOH, CampState.usOK,
      CampState.usOR, CampState.usPA, CampState.usRI, CampState.usSC,
      CampState.usSD, CampState.usTN, CampState.usTX, CampState.usUT,
      CampState.usVA, CampState.usWA, CampState.usWV, CampState.usWI,
      CampState.usWY
    ];

    // Test Australian states with each other
    australianStates.forEach(state1 => {
      australianStates.forEach(state2 => {
        expect(isSameCountry(state1, state2)).toBe(true);
      });
    });

    // Test US states with each other
    usStates.forEach(state1 => {
      usStates.forEach(state2 => {
        expect(isSameCountry(state1, state2)).toBe(true);
      });
    });

    // Test cross-country combinations
    australianStates.forEach(auState => {
      usStates.forEach(usState => {
        expect(isSameCountry(auState, usState)).toBe(false);
      });
    });
  });
});
