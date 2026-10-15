// IRS (Portuguese personal income tax) engine for employees (Category A).
// Pure functions, no DOM — loaded by index.html and testable with Node.
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Legal parameters
  // ---------------------------------------------------------------------------

  const IAS_2026 = 537.13;
  const SS_RATE = 0.11; // employee Social Security contribution
  const REGION_FACTOR = { mainland: 1, azores: 0.7, madeira: 0.7 }; // 30% regional differential

  // Upper limits of brackets 1..8 (bracket 9 is open-ended), taxable income (rendimento coletável)
  const LIMITS_2026 = [8342, 12587, 17838, 23089, 29397, 43090, 46566, 86634];
  const LIMITS_2027 = LIMITS_2026.map((l) => Math.round(l * 1.0388)); // +3.88% (OE2027)

  const RATES_2026_ORIGINAL = [12.5, 15.7, 21.2, 24.1, 31.1, 34.9, 43.1, 44.6, 48];
  // Cut approved by Parliament on 9 Oct 2026, retroactive to 1 Jan 2026; kept for 2027
  const RATES_2026_REVISED = [12.2, 15.2, 20.7, 23.6, 30.6, 34.6, 43.1, 44.6, 48];

  function regime(key, ias2027) {
    const ias = key === '2027' ? ias2027 : IAS_2026;
    const base = {
      ias,
      specificDeduction: round2(8.54 * ias),
      jovemCap: round2(55 * ias),
      minExistence: key === '2027' ? 13580 : 12880,
      rentCap: 800,
    };
    if (key === '2026-original') {
      return { ...base, key, label: '2026 (original)', limits: LIMITS_2026, rates: RATES_2026_ORIGINAL };
    }
    if (key === '2026-revised') {
      return { ...base, key, label: '2026 (after Nov. cut)', limits: LIMITS_2026, rates: RATES_2026_REVISED };
    }
    return { ...base, key: '2027', label: '2027 (OE2027 proposal)', limits: LIMITS_2027, rates: RATES_2026_REVISED };
  }

  // IRS Jovem: share of income exempt by year of benefit (1..10)
  function jovemShare(year) {
    if (!year || year < 1 || year > 10) return 0;
    if (year === 1) return 1;
    if (year <= 4) return 0.75;
    if (year <= 7) return 0.5;
    return 0.25;
  }

  // ---------------------------------------------------------------------------
  // 2026 withholding tables (tabelas de retenção na fonte), dependent work
  // parcel: number, or [k, base] meaning rate × k × (base − R)
  // ---------------------------------------------------------------------------

  const row = (upTo, rate, parcel) => ({ upTo, rate, parcel });

  // Mainland — Despacho (Continente) 2026. Tables I and II share rows.
  const MAINLAND_I_II = [
    row(920, 0, 0),
    row(1042, 12.5, [2.6, 1273.85]),
    row(1108, 15.7, [1.35, 1554.83]),
    row(1154, 15.7, 94.71),
    row(1212, 21.2, 158.18),
    row(1819, 24.1, 193.33),
    row(2119, 31.1, 320.66),
    row(2499, 34.9, 401.19),
    row(3305, 38.36, 487.66),
    row(5547, 39.69, 531.62),
    row(20221, 44.95, 823.4),
    row(Infinity, 47.17, 1272.31),
  ];
  const MAINLAND_III = [
    row(991, 0, 0),
    row(1042, 12.5, [2.6, 1372.15]),
    row(1108, 12.5, [1.35, 1677.85]),
    row(1119, 12.5, 96.17),
    row(1432, 12.72, 98.64),
    row(1962, 15.7, 141.32),
    row(2240, 19.38, 213.53),
    row(2773, 22.77, 289.47),
    row(3389, 25.7, 370.72),
    row(5965, 28.81, 476.12),
    row(20265, 38.43, 1049.96),
    row(Infinity, 47.17, 2821.13),
  ];

  // Azores — Despacho n.º 1179/2026
  const AZORES_I_II = [
    row(966, 0, 0),
    row(1042, 8.75, [2.6, 1337.54]),
    row(1108, 10.99, [1.35, 1652.49]),
    row(1154, 10.99, 80.79),
    row(1212, 14.84, 125.22),
    row(1819, 16.87, 149.83),
    row(2119, 21.77, 238.97),
    row(2499, 24.43, 295.34),
    row(3305, 26.85, 355.82),
    row(5547, 27.79, 386.89),
    row(20221, 31.46, 590.47),
    row(Infinity, 33.02, 905.92),
  ];
  const AZORES_III = [
    row(1226, 0, 0),
    row(1267, 7.28, 89.26),
    row(1602, 9.64, 119.17),
    row(1962, 10.99, 140.8),
    row(2240, 13.57, 191.42),
    row(2900, 15.94, 244.51),
    row(3389, 17.99, 303.96),
    row(5965, 20.17, 377.85),
    row(20265, 27.1, 791.23),
    row(Infinity, 33.02, 1990.92),
  ];

  // Madeira — Despacho n.º 19/2026 (JORAM)
  const MADEIRA_I_II = [
    row(980, 0, 0),
    row(1028, 8.72, [2.6, 1356.92]),
    row(1099, 12.04, [1.35, 1696.78]),
    row(1201, 12.04, 97.17),
    row(1623, 17.63, 164.31),
    row(2332, 22.3, 240.11),
    row(3203, 22.42, 242.91),
    row(3614, 23.7, 283.91),
    row(6585, 30.28, 521.72),
    row(6954, 28.02, 372.9),
    row(21411, 29.24, 457.74),
    row(Infinity, 32.78, 1215.69),
  ];
  const MADEIRA_III = [
    row(997, 0, 0),
    row(1099, 8.72, [1.35, 1819.64]),
    row(1141, 8.72, 84.84),
    row(1857, 10.33, 103.22),
    row(2485, 10.91, 114.0),
    row(3331, 12.36, 150.04),
    row(3895, 14.04, 206.01),
    row(6673, 15.95, 280.41),
    row(6878, 22.13, 692.81),
    row(21411, 24.93, 885.4),
    row(Infinity, 32.78, 2566.17),
  ];

  const WITHHOLDING_TABLES = {
    mainland: { I: MAINLAND_I_II, II: MAINLAND_I_II, III: MAINLAND_III },
    azores: { I: AZORES_I_II, II: AZORES_I_II, III: AZORES_III },
    madeira: { I: MADEIRA_I_II, II: MADEIRA_I_II, III: MADEIRA_III },
  };
  const DEPENDENT_PARCEL = { I: 21.43, II: 34.29, III: 42.86 };
  const TABLE_LABELS = {
    I: 'Table I — single without dependents / married, two earners',
    II: 'Table II — single with dependents',
    III: 'Table III — married, sole earner',
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function round2(x) {
    return Math.round((x + Number.EPSILON) * 100) / 100;
  }

  function regionalRates(rates, region) {
    const f = REGION_FACTOR[region] ?? 1;
    return rates.map((r) => round2(r * f));
  }

  // Progressive tax on one taxable-income quotient, with per-bracket detail
  function progressiveTax(income, limits, rates) {
    let tax = 0;
    let lower = 0;
    const detail = [];
    for (let i = 0; i < rates.length; i++) {
      const upper = i < limits.length ? limits[i] : Infinity;
      const slice = Math.max(0, Math.min(income, upper) - lower);
      const t = (slice * rates[i]) / 100;
      detail.push({ bracket: i + 1, lower, upper, rate: rates[i], slice, tax: t });
      tax += t;
      lower = upper;
      if (income <= upper) break;
    }
    return { tax, detail, marginalRate: detail.length ? detail[detail.length - 1].rate : 0 };
  }

  // Additional solidarity rate (taxa adicional de solidariedade), per quotient
  function solidarity(income) {
    return Math.max(0, Math.min(income, 250000) - 80000) * 0.025 + Math.max(0, income - 250000) * 0.05;
  }

  // Art. 78(7) cap on health/education/rent deductions, by taxable income
  function deductionCap(taxable) {
    if (taxable <= 7703) return Infinity;
    if (taxable >= 80000) return 1000;
    return 1000 + (1500 * (80000 - taxable)) / (80000 - 7703);
  }

  function dependentsDeduction(dependents, under6) {
    const n = Math.max(0, dependents | 0);
    const young = Math.min(n, Math.max(0, under6 | 0));
    // 600 per dependent; +126 if ≤6 years; from the 2nd dependent on, each ≤6 years counts 900
    let total = 0;
    for (let i = 0; i < n; i++) {
      const isYoung = i >= n - young; // count the youngest last
      if (!isYoung) total += 600;
      else total += i >= 1 ? 900 : 726;
    }
    return total;
  }

  function ascendantsDeduction(n) {
    n = Math.max(0, n | 0);
    if (n === 0) return 0;
    return n === 1 ? 635 : 525 * n;
  }

  // ---------------------------------------------------------------------------
  // Annual liability (liquidação)
  // ---------------------------------------------------------------------------

  // earner: { gross, jovemYear }
  function earnerBase(earner, rg) {
    const gross = Math.max(0, earner.gross || 0);
    const ss = gross * SS_RATE;
    const share = jovemShare(earner.jovemYear);
    const exempt = share * Math.min(gross, rg.jovemCap);
    const specific = gross > 0 ? Math.min(gross, Math.max(rg.specificDeduction, ss)) : 0;
    const taxableFull = Math.max(0, gross - specific); // used to determine the rate
    const taxable = Math.max(0, gross - exempt - specific); // actually taxed
    return { gross, ss, exempt, specific, taxableFull, taxable };
  }

  // Tax for a set of earners pooled into one return (single or joint)
  function computeReturn(earners, opts, rg, region) {
    const rates = regionalRates(rg.rates, region);
    const bases = earners.map((e) => earnerBase(e, rg));
    const n = earners.length; // quociente conjugal: 2 for joint returns
    const taxableFull = bases.reduce((s, b) => s + b.taxableFull, 0);
    const taxable = bases.reduce((s, b) => s + b.taxable, 0);
    const gross = bases.reduce((s, b) => s + b.gross, 0);

    const q = taxableFull / n;
    const prog = progressiveTax(q, rg.limits, rates);
    const solid = solidarity(q);
    const collectFull = n * (prog.tax + solid);
    // IRS Jovem exempt income still counts to set the rate (englobamento para determinação da taxa)
    const proportion = taxableFull > 0 ? taxable / taxableFull : 0;
    const collect = collectFull * proportion;

    // Deductions from the tax (deduções à coleta)
    const share = opts.deductionShare ?? 1; // 0.5 for each spouse filing separately
    const singleParent = opts.singleParent;
    const ded = {};
    ded.dependents = dependentsDeduction(opts.dependents, opts.under6) * share;
    ded.ascendants = ascendantsDeduction(opts.ascendants) * share;
    ded.general = opts.assumeGeneral ? (singleParent ? 335 : 250) * n : 0;
    const health = Math.min(1000, 0.15 * (opts.health || 0)) * share;
    const education = Math.min(800, 0.3 * (opts.education || 0)) * share;
    const rent = Math.min(rg.rentCap, 0.15 * (opts.rent || 0)) * share;
    const capped = health + education + rent;
    const cap = deductionCap(taxable / n);
    ded.health = health;
    ded.education = education;
    ded.rent = rent;
    ded.capReduction = Math.max(0, capped - cap);
    const totalDeductions =
      ded.dependents + ded.ascendants + ded.general + capped - ded.capReduction;

    let tax = Math.max(0, collect - totalDeductions);

    // Minimum existence (mínimo de existência): net income after IRS can't drop below it
    const earnersWithIncome = bases.filter((b) => b.gross > 0).length || 1;
    const minFloor = Math.max(0, gross - rg.minExistence * earnersWithIncome);
    const minExistenceApplied = tax > minFloor;
    tax = Math.min(tax, minFloor);

    return {
      rates,
      bases,
      gross,
      ss: bases.reduce((s, b) => s + b.ss, 0),
      exempt: bases.reduce((s, b) => s + b.exempt, 0),
      specific: bases.reduce((s, b) => s + b.specific, 0),
      taxableFull,
      taxable,
      quotient: q,
      bracketDetail: prog.detail.map((d) => ({ ...d, tax: d.tax * n * proportion })),
      marginalRate: prog.marginalRate,
      solidarity: solid * n * proportion,
      collect,
      deductions: ded,
      totalDeductions,
      minExistenceApplied,
      tax: round2(tax),
    };
  }

  // profile: {
  //   gross, region, status: 'single'|'married', spouseGross, filing: 'joint'|'separate',
  //   dependents, under6, ascendants, jovemYear, health, education, rent, assumeGeneral
  // }
  function annualTax(profile, regimeKey, ias2027) {
    const rg = regime(regimeKey, ias2027);
    const region = profile.region || 'mainland';
    const me = { gross: profile.gross, jovemYear: profile.jovemYear };
    const common = {
      dependents: profile.dependents,
      under6: profile.under6,
      ascendants: profile.ascendants,
      health: profile.health,
      education: profile.education,
      rent: profile.rent,
      assumeGeneral: profile.assumeGeneral,
    };

    if (profile.status !== 'married') {
      const r = computeReturn([me], { ...common, singleParent: profile.dependents > 0 }, rg, region);
      return { regime: rg, mode: 'single', household: r, userTax: r.tax, returns: [r] };
    }

    const spouse = { gross: profile.spouseGross || 0, jovemYear: 0 };
    const joint = computeReturn([me, spouse], common, rg, region);
    const sepMe = computeReturn([me], { ...common, deductionShare: 0.5 }, rg, region);
    const sepSp = computeReturn([spouse], { ...common, deductionShare: 0.5 }, rg, region);
    const separateTotal = round2(sepMe.tax + sepSp.tax);
    const best = joint.tax <= separateTotal ? 'joint' : 'separate';
    const mode = profile.filing === 'auto' ? best : profile.filing || 'joint';

    if (mode === 'joint') {
      // Allocate the joint liability to each spouse in proportion to taxable income
      const share = joint.taxable > 0 ? joint.bases[0].taxable / joint.taxable : 0.5;
      return {
        regime: rg,
        mode,
        best,
        jointTotal: joint.tax,
        separateTotal,
        household: joint,
        userTax: round2(joint.tax * share),
        spouseTax: round2(joint.tax * (1 - share)),
        returns: [joint],
      };
    }
    return {
      regime: rg,
      mode,
      best,
      jointTotal: joint.tax,
      separateTotal,
      household: sepMe,
      userTax: sepMe.tax,
      spouseTax: sepSp.tax,
      returns: [sepMe, sepSp],
    };
  }

  // ---------------------------------------------------------------------------
  // Monthly withholding (retenção na fonte) — 2026 tables
  // ---------------------------------------------------------------------------

  function withholdingTableKey(profile) {
    if (profile.status === 'married') return (profile.spouseGross || 0) > 0 ? 'I' : 'III';
    return profile.dependents > 0 ? 'II' : 'I';
  }

  function withholding(R, region, tableKey, dependents) {
    if (R <= 0) return 0;
    const rows = WITHHOLDING_TABLES[region][tableKey];
    const r = rows.find((x) => R <= x.upTo);
    let rate = r.rate;
    if (rate > 0 && dependents >= 3) rate -= 1; // −1 p.p. with 3+ dependents
    const rateD = rate / 100;
    const parcel = Array.isArray(r.parcel) ? rateD * r.parcel[0] * (r.parcel[1] - R) : r.parcel;
    const w = R * rateD - parcel - (rate > 0 ? DEPENDENT_PARCEL[tableKey] * (dependents || 0) : 0);
    return round2(Math.max(0, w));
  }

  // Withholding on one payment, considering the IRS Jovem exempt slice
  function paymentWithholding(R, profile, rg, payments) {
    const share = jovemShare(profile.jovemYear);
    const exempt = share * Math.min(R, rg.jovemCap / 14);
    const base = Math.max(0, R - exempt);
    return withholding(base, profile.region || 'mainland', withholdingTableKey(profile), profile.dependents || 0);
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // 2026 payroll: Jan–Oct and Dec with the 2026 tables; November (salary + Christmas
  // subsidy) withheld at 50%. applyNovemberCut=false gives the "no cut" baseline.
  function payroll2026(profile, applyNovemberCut = true) {
    const payments = profile.payments === 12 ? 12 : 14;
    const R = profile.gross / payments;
    const rg = regime('2026-original');
    const holidayMonth = profile.holidayMonth ?? 5; // June
    const rows = [];
    for (let m = 0; m < 12; m++) {
      const items = [{ kind: 'Salary', gross: R }];
      if (payments === 14 && m === holidayMonth) items.push({ kind: '+ Holiday sub.', gross: R });
      if (payments === 14 && m === 10) items.push({ kind: '+ Christmas sub.', gross: R });
      const factor = applyNovemberCut && m === 10 ? 0.5 : 1;
      for (const it of items) {
        it.ss = round2(it.gross * SS_RATE);
        it.irs = round2(paymentWithholding(it.gross, profile, rg, payments) * factor);
        it.net = round2(it.gross - it.ss - it.irs);
      }
      const sum = (k) => round2(items.reduce((s, i) => s + i[k], 0));
      rows.push({
        month: MONTHS[m],
        items,
        gross: sum('gross'),
        ss: sum('ss'),
        irs: sum('irs'),
        net: sum('net'),
        novemberCut: applyNovemberCut && m === 10,
      });
    }
    const total = (k) => round2(rows.reduce((s, r) => s + r[k], 0));
    return { rows, gross: total('gross'), ss: total('ss'), irs: total('irs'), net: total('net'), payments };
  }

  // 2027: tables not yet published — estimate by scaling the 2026 table withholding
  // by the ratio of 2027 to 2026 annual liability (keeps the tables' usual over-withholding)
  function payroll2027(profile, ias2027) {
    const payments = profile.payments === 12 ? 12 : 14;
    const t = annualTax(profile, '2027', ias2027);
    const t26 = annualTax(profile, '2026-original', ias2027);
    const R = profile.gross / payments;
    const wh26 = paymentWithholding(R, profile, regime('2027', ias2027), payments);
    const irs = round2(t26.userTax > 0 ? (wh26 * t.userTax) / t26.userTax : t.userTax / payments);
    const ss = round2(R * SS_RATE);
    return { payments, gross: R, ss, irs, net: round2(R - ss - irs), annual: t };
  }

  function spouseWithholding2026(profile, applyNovemberCut = true) {
    if (profile.status !== 'married' || !(profile.spouseGross > 0)) return 0;
    const sp = {
      ...profile,
      gross: profile.spouseGross,
      jovemYear: 0,
    };
    return payroll2026(sp, applyNovemberCut).irs;
  }

  const api = {
    IAS_2026,
    SS_RATE,
    LIMITS_2026,
    LIMITS_2027,
    RATES_2026_ORIGINAL,
    RATES_2026_REVISED,
    REGION_FACTOR,
    WITHHOLDING_TABLES,
    DEPENDENT_PARCEL,
    TABLE_LABELS,
    MONTHS,
    regime,
    regionalRates,
    jovemShare,
    progressiveTax,
    dependentsDeduction,
    annualTax,
    withholding,
    withholdingTableKey,
    payroll2026,
    payroll2027,
    spouseWithholding2026,
    round2,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IRS = api;
})(typeof window !== 'undefined' ? window : globalThis);
