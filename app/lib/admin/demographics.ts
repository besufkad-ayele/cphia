export const AGE_BUCKETS = [
  { label: '18–24', min: 18, max: 24 },
  { label: '25–34', min: 25, max: 34 },
  { label: '35–44', min: 35, max: 44 },
  { label: '45–54', min: 45, max: 54 },
  { label: '55–70', min: 55, max: 70 },
] as const;

export type GenderCount = {
  name: 'Male' | 'Female' | 'Unspecified';
  count: number;
  percent: number;
};

export type GenderBySectorRow = {
  sector: string;
  Male: number;
  Female: number;
  Unspecified: number;
  total: number;
};

export type AgeBucketRow = {
  label: string;
  count: number;
  Male: number;
  Female: number;
  Unspecified: number;
};

export type EducationRow = {
  name: string;
  count: number;
  Male: number;
  Female: number;
  Unspecified: number;
  percent: number;
};

export type DemographicsSummary = {
  gender: GenderCount[];
  genderBySector: GenderBySectorRow[];
  age: {
    buckets: AgeBucketRow[];
    mean: number | null;
    median: number | null;
    withAge: number;
  };
  education: EducationRow[];
};

type DemoRow = {
  sex?: string | null;
  age?: number | null;
  sector?: string | null;
  education_level?: string | null;
};

function normalizeGender(sex: string | null | undefined): 'Male' | 'Female' | 'Unspecified' {
  if (sex === 'Male' || sex === 'Female') return sex;
  return 'Unspecified';
}

function percent(count: number, total: number) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function mean(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
  }
  return sorted[mid]!;
}

export function buildDemographics(rows: DemoRow[]): DemographicsSummary {
  const genderTotals = { Male: 0, Female: 0, Unspecified: 0 };
  const sectorMap = new Map<string, GenderBySectorRow>();
  const educationMap = new Map<string, EducationRow>();
  const ages: number[] = [];
  const ageBuckets: AgeBucketRow[] = AGE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: 0,
    Male: 0,
    Female: 0,
    Unspecified: 0,
  }));

  for (const row of rows) {
    const gender = normalizeGender(row.sex);
    genderTotals[gender] += 1;

    const sector = row.sector || 'Other';
    const sectorRow = sectorMap.get(sector) ?? {
      sector,
      Male: 0,
      Female: 0,
      Unspecified: 0,
      total: 0,
    };
    sectorRow[gender] += 1;
    sectorRow.total += 1;
    sectorMap.set(sector, sectorRow);

    const education = row.education_level?.trim() || 'Unspecified';
    const educationRow = educationMap.get(education) ?? {
      name: education,
      count: 0,
      Male: 0,
      Female: 0,
      Unspecified: 0,
      percent: 0,
    };
    educationRow[gender] += 1;
    educationRow.count += 1;
    educationMap.set(education, educationRow);

    const age = typeof row.age === 'number' && Number.isFinite(row.age) ? row.age : null;
    if (age != null) {
      ages.push(age);
      const bucketIndex = AGE_BUCKETS.findIndex((bucket) => age >= bucket.min && age <= bucket.max);
      if (bucketIndex >= 0) {
        const bucket = ageBuckets[bucketIndex]!;
        bucket.count += 1;
        bucket[gender] += 1;
      }
    }
  }

  const total = rows.length;
  const gender: GenderCount[] = (['Male', 'Female', 'Unspecified'] as const)
    .map((name) => ({
      name,
      count: genderTotals[name],
      percent: percent(genderTotals[name], total),
    }))
    .filter((row) => row.name !== 'Unspecified' || row.count > 0);

  const education = [...educationMap.values()]
    .map((row) => ({ ...row, percent: percent(row.count, total) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    gender,
    genderBySector: [...sectorMap.values()].sort(
      (a, b) => b.total - a.total || a.sector.localeCompare(b.sector),
    ),
    age: {
      buckets: ageBuckets,
      mean: mean(ages),
      median: median(ages),
      withAge: ages.length,
    },
    education,
  };
}
