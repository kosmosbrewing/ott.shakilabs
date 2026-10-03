/**
 * 데이터 파생 관찰 계산기 — 44개국 요금 시드에서만 나오는 사실을 뽑는다.
 *
 * 왜 별도 파일인가: seo-content.mjs는 "문구"를 담당하고, 여기는 "숫자"만 담당한다.
 * 문구가 숫자를 하드코딩하면 시드가 갱신될 때 산문만 옛날 값으로 남는다 —
 * 그래서 본문에 나가는 모든 수치는 여기서 계산해 주입한다.
 *
 * 정직성 제약(이 파일이 절대 하지 않는 것):
 *  - 시점 간 가격 변동을 만들지 않는다. 전수 조사는 1회분(lastUpdated)뿐이고 그 뒤 재확인은
 *    일부 칸뿐이라(행마다 survey 블록) "올랐다/내렸다/추세"를 계산할 근거가 없다.
 *  - 요금 조사일과 환율 기준일을 하나로 묶지 않는다. 성격이 다른 두 관측이다.
 *  - 환율 시나리오는 "가정"으로만 계산한다. 관측된 환율 변동이 아니다.
 *
 * Node(프리렌더)와 Vite(브라우저) 양쪽에서 import되므로 런타임 전용 API 금지.
 */

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;

/** 개인 플랜 원화 오름차순. data는 configureSeoContent가 KRW 보정을 마친 시드다. */
export function individualsByKrw(data) {
  return data.prices
    .filter((p) => p.converted?.individual?.krw)
    .map((p) => ({
      country: p.country,
      code: String(p.countryCode || "").toUpperCase(),
      continent: p.continent || "unknown",
      currency: String(p.currency || "").toUpperCase(),
      local: p.plans?.individual?.monthly ?? null,
      krw: p.converted.individual.krw,
      usd: p.converted.individual.usd,
    }))
    .sort((a, b) => a.krw - b.krw);
}

export function baseCountryKrw(data) {
  const base = data.prices.find(
    (p) => String(p.countryCode || "").toUpperCase() === String(data.baseCountry || "").toUpperCase()
  );
  return base?.plans?.individual?.monthly ?? base?.converted?.individual?.krw ?? null;
}

/** 요금제별 보유 국가 수 — 레지스트리 선언과 실제 데이터의 간극을 드러낸다. */
export function planCoverage(data) {
  const counts = {};
  let cells = 0;
  for (const p of data.prices) {
    for (const [planId, plan] of Object.entries(p.plans || {})) {
      if (!Number.isFinite(Number(plan?.monthly))) continue;
      counts[planId] = (counts[planId] || 0) + 1;
      cells += 1;
    }
  }
  const missingFamily = data.prices
    .filter((p) => !Number.isFinite(Number(p.plans?.family?.monthly)))
    .map((p) => p.country);
  return { counts, cells, countryCount: data.prices.length, missingFamily };
}

/** 통화 구조 — 환산 없이 직접 비교 가능한 쌍이 몇 개인지까지 센다. */
export function currencyStructure(data) {
  const byCurrency = new Map();
  for (const p of data.prices) {
    const cur = String(p.currency || "").toUpperCase();
    byCurrency.set(cur, [...(byCurrency.get(cur) || []), p.country]);
  }
  const shared = [...byCurrency.entries()].filter(([, list]) => list.length > 1);
  const solo = [...byCurrency.values()].filter((list) => list.length === 1).length;
  const n = data.prices.length;
  const totalPairs = (n * (n - 1)) / 2;
  const sameCurrencyPairs = [...byCurrency.values()].reduce(
    (sum, list) => sum + (list.length * (list.length - 1)) / 2,
    0
  );
  return {
    currencyCount: byCurrency.size,
    shared: shared.map(([cur, list]) => ({ currency: cur, countries: list })),
    soloCurrencyCount: solo,
    totalPairs,
    sameCurrencyPairs,
    convertedPairs: totalPairs - sameCurrencyPairs,
  };
}

/** 현지 정가 표기 관습 — 44개국을 직접 조사했기 때문에만 셀 수 있는 값. */
export function notationConventions(data) {
  let decimal99 = 0;
  let lastDigitNine = 0;
  let decimals = 0;
  for (const p of data.prices) {
    const value = p.plans?.individual?.monthly;
    if (!Number.isFinite(Number(value))) continue;
    const text = String(value);
    if (/\.\d*99$/.test(text)) decimal99 += 1;
    if (text.replace(".", "").endsWith("9")) lastDigitNine += 1;
    if (!Number.isInteger(Number(value))) decimals += 1;
  }
  return {
    decimal99,
    lastDigitNine,
    decimals,
    integers: data.prices.length - decimals,
  };
}

/**
 * 환산 감사 — converted.krw가 round(usd × krwRate)로 재현되는지 전수 검증한다.
 * 재현된다면 원화 열은 독립 관측이 아니라 달러값의 함수라는 뜻이다.
 */
export function conversionAudit(rawSeed) {
  const rate = Number(rawSeed.krwRate);
  let checked = 0;
  const mismatches = [];
  for (const p of rawSeed.prices) {
    for (const [planId, amount] of Object.entries(p.converted || {})) {
      if (!Number.isFinite(Number(amount?.usd)) || !Number.isFinite(Number(amount?.krw))) continue;
      checked += 1;
      if (Math.round(amount.usd * rate) !== amount.krw) {
        mismatches.push(`${p.country}/${planId}`);
      }
    }
  }
  const base = rawSeed.prices.find(
    (p) => String(p.countryCode || "").toUpperCase() === String(rawSeed.baseCountry || "").toUpperCase()
  );
  const roundTrip = Object.entries(base?.plans || {})
    .filter(([, plan]) => Number.isFinite(Number(plan?.monthly)))
    .map(([planId, plan]) => ({
      planId,
      local: plan.monthly,
      derived: base.converted?.[planId]?.krw ?? null,
    }))
    .filter((row) => row.derived != null && row.derived !== row.local);
  return { rate, checked, mismatches, roundTrip };
}

/** 달러 구간별 국가 수와 "달러당 밀도" — 가격대가 연속인지 군집인지 판정한다. */
export function usdBandDensity(data, bounds = [0, 5, 10, 15, 20, 25]) {
  const rows = individualsByKrw(data);
  const bands = [];
  for (let i = 1; i < bounds.length; i += 1) {
    const lo = bounds[i - 1];
    const hi = bounds[i];
    const members = rows.filter((r) => r.usd >= lo && r.usd < hi);
    bands.push({ lo, hi, count: members.length, density: round2(members.length / (hi - lo)) });
  }
  return bands;
}

/** 기준국 주변 밀집도 — 가까운 이웃이 어느 쪽에 몰려 있는지. */
export function baseNeighborhood(data, tolerance = 0.05) {
  const rows = individualsByKrw(data);
  const baseKrw = baseCountryKrw(data);
  const baseCode = String(data.baseCountry || "").toUpperCase();
  const within = rows.filter(
    (r) => r.code !== baseCode && Math.abs(r.krw - baseKrw) / baseKrw <= tolerance
  );
  const cheaper = rows.filter((r) => r.krw < baseKrw);
  const nearestCheaper = cheaper[cheaper.length - 1] || null;
  return {
    baseKrw,
    tolerance,
    within,
    cheaperWithin: within.filter((r) => r.krw < baseKrw),
    nearestCheaper,
    nearestCheaperGapPercent: nearestCheaper
      ? round1(((nearestCheaper.krw - baseKrw) / baseKrw) * 100)
      : null,
    rankAsc: rows.findIndex((r) => r.code === baseCode) + 1,
    total: rows.length,
  };
}

/** 인접 순위 간 상대 격차 — 가격대의 "계단"을 찾는다. */
export function adjacentGaps(data, minPercent = 10) {
  const rows = individualsByKrw(data);
  const gaps = [];
  for (let i = 1; i < rows.length; i += 1) {
    gaps.push({
      from: rows[i - 1].country,
      to: rows[i].country,
      fromKrw: rows[i - 1].krw,
      toKrw: rows[i].krw,
      percent: round1((rows[i].krw / rows[i - 1].krw - 1) * 100),
    });
  }
  return {
    all: gaps,
    big: gaps.filter((g) => g.percent >= minPercent).sort((a, b) => b.percent - a.percent),
  };
}

/** 대륙별 평균·중앙값·내부 격차 — 평균이 무엇을 가리는지 본다. */
export function continentStats(data) {
  const rows = individualsByKrw(data);
  const groups = new Map();
  for (const r of rows) groups.set(r.continent, [...(groups.get(r.continent) || []), r]);
  return [...groups.entries()]
    .map(([continent, members]) => {
      const values = members.map((m) => m.krw).sort((a, b) => a - b);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const median =
        values.length % 2
          ? values[(values.length - 1) / 2]
          : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
      return {
        continent,
        count: values.length,
        mean: Math.round(mean),
        median: Math.round(median),
        meanOverMedian: round2(mean / median),
        min: values[0],
        max: values[values.length - 1],
        spread: round1(values[values.length - 1] / values[0]),
        cheapest: members.reduce((a, b) => (a.krw <= b.krw ? a : b)).country,
        priciest: members.reduce((a, b) => (a.krw >= b.krw ? a : b)).country,
      };
    })
    .sort((a, b) => a.mean - b.mean);
}

/**
 * 패밀리÷개인 배수 — 반드시 현지 통화로 계산한다.
 * 원화 환산값으로 재면 반올림 때문에 인도(299/149=2.007)가 정확히 2.000으로 보인다.
 */
export function familyMultiples(data) {
  const rows = data.prices
    .filter(
      (p) =>
        Number.isFinite(Number(p.plans?.family?.monthly)) &&
        Number.isFinite(Number(p.plans?.individual?.monthly))
    )
    .map((p) => ({
      country: p.country,
      currency: String(p.currency || "").toUpperCase(),
      individualLocal: p.plans.individual.monthly,
      familyLocal: p.plans.family.monthly,
      multiple: round3(p.plans.family.monthly / p.plans.individual.monthly),
      breakEvenHeads: Math.floor(p.plans.family.monthly / p.plans.individual.monthly) + 1,
    }))
    .sort((a, b) => a.multiple - b.multiple);
  return {
    rows,
    count: rows.length,
    min: rows[0] || null,
    max: rows[rows.length - 1] || null,
    exactlyTwo: rows.filter((r) => r.familyLocal === r.individualLocal * 2).length,
    underTwo: rows.filter((r) => r.familyLocal < r.individualLocal * 2).length,
    overTwo: rows.filter((r) => r.familyLocal > r.individualLocal * 2).length,
    breakEvenTwo: rows.filter((r) => r.breakEvenHeads === 2).length,
    breakEvenThree: rows.filter((r) => r.breakEvenHeads === 3).length,
  };
}

/** 개인 순위 ↔ 패밀리 순위 역전 쌍. A가 개인은 더 싼데 패밀리는 더 비싼 경우. */
export function familyRankReversals(data, excludeCountries = []) {
  const excluded = new Set(excludeCountries);
  const rows = data.prices
    .filter((p) => p.converted?.family?.krw && p.converted?.individual?.krw)
    .map((p) => ({
      country: p.country,
      individual: p.converted.individual.krw,
      family: p.converted.family.krw,
    }));
  const pairs = [];
  for (const a of rows) {
    for (const b of rows) {
      if (a === b) continue;
      if (excluded.has(a.country) || excluded.has(b.country)) continue;
      if (a.individual < b.individual && a.family > b.family) {
        pairs.push({ a, b, score: (b.individual - a.individual) + (a.family - b.family) });
      }
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  return { count: pairs.length, top: pairs.slice(0, 5) };
}

/** 유로존 — 통화가 같아 환율 효과가 0인 실험군. */
export function eurozoneContrast(data) {
  const members = data.prices
    .filter((p) => String(p.currency || "").toUpperCase() === "EUR")
    .map((p) => ({
      country: p.country,
      individual: p.plans?.individual?.monthly ?? null,
      family: p.plans?.family?.monthly ?? null,
      individualKrw: p.converted?.individual?.krw ?? null,
    }));
  const byIndividual = new Map();
  for (const m of members) byIndividual.set(m.individual, [...(byIndividual.get(m.individual) || []), m.country]);
  const byFamily = new Map();
  for (const m of members) byFamily.set(m.family, [...(byFamily.get(m.family) || []), m.country]);
  const cheapIndividual = Math.min(...members.map((m) => m.individual));
  const cheapGroup = members.filter((m) => m.individual === cheapIndividual);
  const otherGroup = members.filter((m) => m.individual !== cheapIndividual);
  return {
    members,
    individualGroups: [...byIndividual.entries()].map(([price, countries]) => ({ price, countries })),
    familyGroups: [...byFamily.entries()].map(([price, countries]) => ({ price, countries })),
    cheapGroup,
    otherGroup,
    // 개인이 싼 쪽이 패밀리는 비싼가 — 환율을 완전히 제거한 상태의 역전 여부
    reversed:
      cheapGroup.length > 0 &&
      otherGroup.length > 0 &&
      cheapGroup[0].individual < otherGroup[0].individual &&
      cheapGroup[0].family > otherGroup[0].family,
  };
}

/** 패밀리를 N명이 나눌 때 기준국 개인 요금보다 싼 나라 수. 경계가 어디서 무너지는지 본다. */
export function familySplitThresholds(data, heads = [5, 4, 3, 2]) {
  const baseKrw = baseCountryKrw(data);
  const rows = data.prices
    .filter((p) => p.converted?.family?.krw)
    .map((p) => ({ country: p.country, family: p.converted.family.krw }));
  return {
    baseKrw,
    total: rows.length,
    levels: heads.map((n) => {
      const failing = rows.filter((r) => r.family / n >= baseKrw);
      return {
        heads: n,
        passing: rows.length - failing.length,
        failing: failing.map((r) => r.country),
        worst: rows.reduce((a, b) => (a.family >= b.family ? a : b)),
        worstPerHead: Math.round(rows.reduce((a, b) => (a.family >= b.family ? a : b)).family / n),
      };
    }),
  };
}

/** 라이트 보유국 — 개인 요금 순위와 라이트 할인율. */
export function litePlans(data) {
  const rows = individualsByKrw(data);
  const rankOf = new Map(rows.map((r, i) => [r.code, i + 1]));
  const members = data.prices
    .filter((p) => p.converted?.lite?.krw)
    .map((p) => ({
      country: p.country,
      code: String(p.countryCode || "").toUpperCase(),
      individual: p.converted.individual.krw,
      lite: p.converted.lite.krw,
      ratio: round3(p.converted.lite.krw / p.converted.individual.krw),
      rank: rankOf.get(String(p.countryCode || "").toUpperCase()),
    }))
    .sort((a, b) => a.rank - b.rank);
  const ranks = members.map((m) => m.rank).sort((a, b) => a - b);
  // 라이트가 하나도 없는 가장 긴 연속 순위 구간
  let gapStart = null;
  let gapEnd = null;
  for (let i = 1; i < ranks.length; i += 1) {
    const span = ranks[i] - ranks[i - 1] - 1;
    if (span > (gapEnd == null ? 0 : gapEnd - gapStart + 1)) {
      gapStart = ranks[i - 1] + 1;
      gapEnd = ranks[i] - 1;
    }
  }
  return {
    members,
    ranks,
    gapStart,
    gapEnd,
    gapLength: gapStart == null ? 0 : gapEnd - gapStart + 1,
    minRatio: members.reduce((a, b) => (a.ratio <= b.ratio ? a : b)),
    others: members.filter((m) => m.ratio !== Math.min(...members.map((x) => x.ratio))),
  };
}

/** 듀오 보유국 — 2인분 대비, 패밀리 대비. */
export function duoPlans(data) {
  return data.prices
    .filter((p) => p.converted?.duo?.krw)
    .map((p) => ({
      country: p.country,
      duo: p.converted.duo.krw,
      individual: p.converted.individual.krw,
      family: p.converted.family?.krw ?? null,
      vsTwoSolo: round3(p.converted.duo.krw / (2 * p.converted.individual.krw)),
      vsFamily: p.converted.family?.krw
        ? round3(p.converted.duo.krw / p.converted.family.krw)
        : null,
    }))
    .sort((a, b) => a.vsTwoSolo - b.vsTwoSolo);
}

/**
 * 가정 시나리오: 환율이 다른 값이었다면 기준국 순위가 어디서 바뀌는가.
 *
 * 관측이 아니다. 외국 요금의 원화값은 전부 같은 스칼라(krwRate)를 곱한 값이라
 * 환율이 변해도 외국끼리의 순서는 보존되고, 원화가 원본인 기준국만 자리를 옮긴다.
 * 그 성질을 이용해 "순위가 얼마나 견고한가"를 임계 환율로 정량화한다.
 */
export function fxRankThresholds(data) {
  const rate = Number(data.krwRate);
  const baseKrw = baseCountryKrw(data);
  const baseCode = String(data.baseCountry || "").toUpperCase();
  const foreign = individualsByKrw(data).filter((r) => r.code !== baseCode);
  // 임계를 막 지난 직후의 순위. 반올림한 퍼센트로 시나리오를 돌리면 임계를 못 넘는
  // 경우가 생기므로(체코 6.1417%를 6.14%로 재현하면 통과 실패) 반드시 원값으로 민다.
  const rankJustPast = (exactDelta) => {
    const scenarioRate = rate * (1 + exactDelta) * (exactDelta < 0 ? 1 - 1e-9 : 1 + 1e-9);
    return foreign.filter((r) => r.usd * scenarioRate < baseKrw).length + 1;
  };
  const crossings = foreign
    .map((r) => {
      const exactDelta = baseKrw / r.usd / rate - 1;
      return {
        country: r.country,
        krw: r.krw,
        rateNeeded: round2(baseKrw / r.usd),
        deltaPercent: round2(exactDelta * 100),
        rankAfter: rankJustPast(exactDelta),
      };
    })
    .sort((a, b) => a.deltaPercent - b.deltaPercent);
  const exact = foreign
    .map((r) => ({ country: r.country, delta: baseKrw / r.usd / rate - 1 }))
    .sort((a, b) => a.delta - b.delta);
  const down = crossings.filter((c) => c.deltaPercent < 0).sort((a, b) => b.deltaPercent - a.deltaPercent);
  const up = crossings.filter((c) => c.deltaPercent > 0).sort((a, b) => a.deltaPercent - b.deltaPercent);
  // 반올림한 퍼센트로 비를 만들면 0.07이 분모가 돼 값이 크게 흔들린다 — 원값으로 계산한다
  const exactDown = exact.filter((e) => e.delta < 0).sort((a, b) => b.delta - a.delta)[0] || null;
  const exactUp = exact.filter((e) => e.delta > 0).sort((a, b) => a.delta - b.delta)[0] || null;
  const asymmetryRatio =
    exactDown && exactUp ? round1(Math.abs(exactUp.delta / exactDown.delta)) : null;
  return {
    asymmetryRatio,
    rate,
    baseKrw,
    crossings,
    firstDown: down[0] || null,
    secondDown: down[1] || null,
    thirdDown: down[2] || null,
    fourthDown: down[3] || null,
    firstUp: up[0] || null,
    secondUp: up[1] || null,
    within20: crossings.filter((c) => Math.abs(c.deltaPercent) <= 20),
  };
}

/** 가정 시나리오 표: 환율이 ±x%였다면 기준국은 몇 위였을까. */
export function fxRankScenarios(data, percents = [-10, -5, -2, 0, 2, 5, 10]) {
  const rate = Number(data.krwRate);
  const baseKrw = baseCountryKrw(data);
  const baseCode = String(data.baseCountry || "").toUpperCase();
  const foreign = individualsByKrw(data).filter((r) => r.code !== baseCode);
  return percents.map((percent) => {
    const scenarioRate = rate * (1 + percent / 100);
    const cheaper = foreign.filter((r) => r.usd * scenarioRate < baseKrw).length;
    return { percent, rate: Math.round(scenarioRate), rank: cheaper + 1 };
  });
}

/** 원화 정렬과 달러 정렬이 같은 순서를 주는지 — 통화 토글이 순위를 바꾸는지의 판정. */
export function orderingInvariance(data) {
  const byKrw = individualsByKrw(data).map((r) => r.code);
  const byUsd = individualsByKrw(data)
    .slice()
    .sort((a, b) => a.usd - b.usd)
    .map((r) => r.code);
  const mismatches = byKrw.filter((code, i) => code !== byUsd[i]);
  return { byKrw, byUsd, mismatchCount: mismatches.length };
}

/** 같은 표시 숫자가 여러 통화에 등장하는 경우 — 숫자만으로는 비교가 안 된다는 증거. */
export function numeralCollisions(data) {
  const groups = new Map();
  for (const p of data.prices) {
    const value = p.plans?.individual?.monthly;
    if (!Number.isFinite(Number(value))) continue;
    groups.set(value, [
      ...(groups.get(value) || []),
      {
        country: p.country,
        currency: String(p.currency || "").toUpperCase(),
        krw: p.converted?.individual?.krw ?? null,
      },
    ]);
  }
  return [...groups.entries()]
    .filter(([, list]) => new Set(list.map((x) => x.currency)).size > 1)
    .map(([numeral, list]) => {
      const values = list.map((x) => x.krw);
      return {
        numeral,
        entries: list,
        spread: round2(Math.max(...values) / Math.min(...values)),
      };
    })
    .sort((a, b) => b.spread - a.spread);
}

/** 원화 동률 묶음 — 진짜 동률(현지 정가가 같다)인지, 환산 반올림이 만든 가짜인지 구분한다. */
export function krwTies(data) {
  const groups = new Map();
  for (const r of individualsByKrw(data)) groups.set(r.krw, [...(groups.get(r.krw) || []), r]);
  const ties = [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([krw, list]) => ({
      krw,
      members: list,
      // 현지 통화와 정가가 모두 같으면 진짜 동률이다
      genuine:
        new Set(list.map((m) => m.currency)).size === 1 &&
        new Set(list.map((m) => m.local)).size === 1,
    }));
  return {
    ties,
    tiedCountries: ties.reduce((sum, t) => sum + t.members.length, 0),
    artificial: ties.filter((t) => !t.genuine).length,
  };
}

/** 요금 조사일과 환율 기준일의 간격(일). 두 날짜를 절대 하나로 묶지 않기 위한 값. */
export function surveyDateGapDays(data) {
  const priced = Date.parse(`${data.lastUpdated}T00:00:00Z`);
  const fx = Date.parse(`${data.exchangeRateDate}T00:00:00Z`);
  if (!Number.isFinite(priced) || !Number.isFinite(fx)) return null;
  return Math.round(Math.abs(fx - priced) / 86400000);
}

/** 최저가 대비 최고가 배수 — 전체 격차의 크기. */
export function globalSpread(data) {
  const rows = individualsByKrw(data);
  const cheapest = rows[0];
  const priciest = rows[rows.length - 1];
  return {
    cheapest,
    priciest,
    spread: round1(priciest.krw / cheapest.krw),
  };
}

/** 나라별 요금제 보유 조합 — 44개국이 실제로 보이는 구성이 몇 가지인지. */
export function planCombinations(data) {
  const groups = new Map();
  for (const p of data.prices) {
    const ids = Object.entries(p.plans || {})
      .filter(([, plan]) => Number.isFinite(Number(plan?.monthly)))
      .map(([id]) => id)
      .sort();
    const key = ids.join("+");
    groups.set(key, {
      ids,
      countries: [...(groups.get(key)?.countries || []), p.country],
    });
  }
  return [...groups.values()].sort((a, b) => b.countries.length - a.countries.length);
}

/** 월/연 요금 칸 채움률 — 비어 있는 축이 어디인지. */
export function billingPeriodCoverage(data) {
  let cells = 0;
  let monthly = 0;
  let yearly = 0;
  for (const p of data.prices) {
    for (const plan of Object.values(p.plans || {})) {
      cells += 1;
      // Number(null) === 0 이라 Number.isFinite만 쓰면 빈 칸이 "채워짐"으로 세어진다.
      // 이 함수가 세는 대상이 정확히 "빈 칸"이므로 null 검사가 본질이다.
      if (plan?.monthly != null && Number.isFinite(Number(plan.monthly))) monthly += 1;
      if (plan?.yearly != null && Number.isFinite(Number(plan.yearly))) yearly += 1;
    }
  }
  return { cells, monthly, yearly };
}

/**
 * 현지 표시 숫자의 크기 순서와 원화 순위의 어긋남.
 * "표시가가 작다 = 싸다"가 성립하지 않는다는 것을 가장 큰/작은 표시가로 보인다.
 */
export function numeralMagnitudeContrast(data) {
  const rows = individualsByKrw(data);
  const rankByCode = new Map(rows.map((r, i) => [r.code, i + 1]));
  const byNumeral = rows
    .slice()
    .sort((a, b) => a.local - b.local)
    .map((r) => ({ ...r, rank: rankByCode.get(r.code) }));
  const smallestNumeral = byNumeral[0].local;
  return {
    smallest: byNumeral.filter((r) => r.local === smallestNumeral),
    largest: byNumeral[byNumeral.length - 1],
    total: rows.length,
  };
}

/** 기준선을 바꾸면 같은 격차가 다른 퍼센트로 읽힌다 — 절약률 분모의 비대칭. */
export function savingsDenominatorAsymmetry(data) {
  const rows = individualsByKrw(data);
  const baseKrw = baseCountryKrw(data);
  const cheapest = rows[0];
  const priciest = rows[rows.length - 1];
  return {
    baseKrw,
    cheapest,
    priciest,
    // 한국을 분모로: "한국보다 88% 싸다"
    cheaperPercentFromBase: round1(((baseKrw - cheapest.krw) / baseKrw) * 100),
    // 최저가국을 분모로: "최저가국보다 753% 비싸다"
    pricierPercentFromCheapest: round1((baseKrw / cheapest.krw - 1) * 100),
    // 상한: 절약률은 아무리 커도 100%를 못 넘는다
    maxSavingsPercent: round1(((baseKrw - cheapest.krw) / baseKrw) * 100),
    maxMarkupPercent: round1((priciest.krw / cheapest.krw - 1) * 100),
  };
}

// ---------------------------------------------------------------------------
// 요금 조사 회차 — 국가 행의 survey 블록이 유일한 출처다.
//
// 왜 여기서 세나: 전수 조사일(surveyedAt)과 공식 출처 재확인일(recheckedAt)은 칸마다 다르다.
// 문장에 "11개국 재확인" 같은 숫자를 손으로 쓰면 다음 재확인 때 산문만 옛 숫자로 남고,
// 재확인하지 못한 값까지 새 날짜로 읽히게 된다(2026-10-03 회차에서 실제로 그럴 뻔했다).
// ---------------------------------------------------------------------------

const PLAN_LABEL = { individual: "개인", family: "패밀리", lite: "라이트", duo: "듀오", student: "학생" };

/** "2026-02-20" → "02-20". 표 안의 작은 표시용(연도는 문장에 이미 있다). */
export const monthDay = (date) => String(date || "").slice(5);

function onlyValue(values, field) {
  const set = [...new Set(values.filter(Boolean))];
  if (set.length > 1) {
    throw new Error(`survey.${field}가 회차 하나로 모이지 않는다: ${set.join(", ")}`);
  }
  return set[0] ?? null;
}

/** 회차 요약 — 전부 survey 블록에서 센다. */
export function surveyRounds(data) {
  const rows = data.prices;
  const rechecked = rows.filter((r) => r.survey?.recheckedAt);
  const updated = rows
    .filter((r) => r.survey?.previous && Object.keys(r.survey.previous).length > 0)
    .map((r) => ({ code: r.countryCode, country: r.country, cells: Object.keys(r.survey.previous).length }));
  return {
    fullSurveyDate: onlyValue(rows.map((r) => r.survey?.surveyedAt), "surveyedAt"),
    recheckDate: onlyValue(rows.map((r) => r.survey?.recheckedAt), "recheckedAt"),
    countryCount: rows.length,
    recheckedCountries: rechecked.length,
    // 재확인 국가 중 일부 요금제만 확인된 나라 — 나머지 칸은 전수 조사 값 그대로다
    partialCountries: rechecked.filter((r) => (r.survey.unverified || []).length > 0).length,
    recheckedCells: rechecked.reduce((n, r) => n + Object.keys(r.survey.verified || {}).length, 0),
    retainedCountries: rows.length - rechecked.length,
    retainedCells: rows.reduce((n, r) => n + (r.survey?.unverified || []).length, 0),
    updated,
    updatedCells: updated.reduce((n, u) => n + u.cells, 0),
  };
}

/**
 * 가격표 페이지의 요금 조사 문장. 숫자는 전부 surveyRounds에서 온다.
 * 예: "2026-02-20 전수 조사 · 2026-10-03 공식 출처로 11개국 재확인(미국 3개 값 갱신, 9개국은 일부 요금제만), 나머지 33개국은 02-20 값"
 */
export function surveyProvenanceSentence(data) {
  const r = surveyRounds(data);
  if (!r.recheckDate) return `${r.fullSurveyDate} 전수 조사`;
  const details = [
    r.updated.length > 0
      ? `${r.updated.map((u) => `${u.country} ${u.cells}개`).join("·")} 값 갱신`
      : "값 변동 없음",
  ];
  if (r.partialCountries > 0) details.push(`${r.partialCountries}개국은 일부 요금제만`);
  return (
    `${r.fullSurveyDate} 전수 조사 · ${r.recheckDate} 공식 출처로 ${r.recheckedCountries}개국 재확인(${details.join(", ")}), ` +
    `나머지 ${r.retainedCountries}개국은 ${monthDay(r.fullSurveyDate)} 값`
  );
}

/** 표 한 칸의 조사 상태 — 재확인한 칸만 재확인 날짜를 단다. */
export function surveyCellMark(row, planId) {
  const survey = row?.survey;
  if (!survey || row?.plans?.[planId]?.monthly == null) return null;
  if (survey.verified?.[planId] && survey.recheckedAt) {
    return { status: "rechecked", text: `재확인 ${monthDay(survey.recheckedAt)}` };
  }
  return { status: "retained", text: `${monthDay(survey.surveyedAt)} 값 유지` };
}

/** 국가 상세 페이지의 조사 표기 — 재확인 날짜는 재확인한 요금제에만 붙인다. */
export function surveyCountryLabel(row) {
  const survey = row?.survey;
  if (!survey?.surveyedAt) return null;
  const base = `요금 조사 ${survey.surveyedAt}`;
  const verified = Object.keys(survey.verified || {});
  if (!survey.recheckedAt || verified.length === 0) return base;
  const scope =
    (survey.unverified || []).length === 0
      ? "전 요금제"
      : `${verified.map((p) => PLAN_LABEL[p] || p).join("·")} 요금제만`;
  return `${base} · ${survey.recheckedAt} 공식 출처 재확인(${scope})`;
}
