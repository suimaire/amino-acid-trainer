import { AMINO_ACID_BY_ID, type AminoAcid, type CategoryId } from './aminoAcids';

interface ReferenceValues {
  id: string;
  mr: number;
  pK1: number;
  pK2: number;
  pKR: number | null;
  pI: number;
  hydropathy: number;
  features: readonly string[];
}

export interface AminoAcidProperty extends ReferenceValues,
  Pick<AminoAcid, 'name' | 'koreanName' | 'threeLetter' | 'oneLetter' | 'category'> {}

// User-supplied free-amino-acid reference values; hydropathy: Kyte–Doolittle.
// This order belongs to the reference table and does not reorder the learning data.
const REFERENCE_VALUES: readonly ReferenceValues[] = [
  { id: 'glycine', mr: 75, pK1: 2.34, pK2: 9.60, pKR: null, pI: 5.97, hydropathy: -0.4,
    features: ['가장 작은 곁사슬', '비키랄성', '높은 구조적 유연성'] },
  { id: 'alanine', mr: 89, pK1: 2.34, pK2: 9.69, pKR: null, pI: 6.01, hydropathy: 1.8,
    features: ['작은 비극성 곁사슬', '소수성'] },
  { id: 'proline', mr: 115, pK1: 1.99, pK2: 10.96, pKR: null, pI: 6.48, hydropathy: -1.6,
    features: ['고리형 곁사슬', '주사슬 형태 제약'] },
  { id: 'valine', mr: 117, pK1: 2.32, pK2: 9.62, pKR: null, pI: 5.97, hydropathy: 4.2,
    features: ['가지사슬', '소수성'] },
  { id: 'leucine', mr: 131, pK1: 2.36, pK2: 9.60, pKR: null, pI: 5.98, hydropathy: 3.8,
    features: ['가지사슬', '소수성'] },
  { id: 'isoleucine', mr: 131, pK1: 2.36, pK2: 9.68, pKR: null, pI: 6.02, hydropathy: 4.5,
    features: ['가지사슬', 'β-탄소 입체중심'] },
  { id: 'methionine', mr: 149, pK1: 2.28, pK2: 9.21, pKR: null, pI: 5.74, hydropathy: 1.9,
    features: ['황 함유', '싸이오에터'] },
  { id: 'phenylalanine', mr: 165, pK1: 1.83, pK2: 9.13, pKR: null, pI: 5.48, hydropathy: 2.8,
    features: ['방향족', '소수성'] },
  { id: 'tyrosine', mr: 181, pK1: 2.20, pK2: 9.11, pKR: 10.07, pI: 5.66, hydropathy: -1.3,
    features: ['방향족 · 페놀성 OH', '인산화 가능', '이온화 가능 곁사슬'] },
  { id: 'tryptophan', mr: 204, pK1: 2.38, pK2: 9.39, pKR: null, pI: 5.89, hydropathy: -0.9,
    features: ['방향족', '인돌', '부피가 큰 곁사슬'] },
  { id: 'serine', mr: 105, pK1: 2.21, pK2: 9.15, pKR: null, pI: 5.68, hydropathy: -0.8,
    features: ['하이드록실', '수소 결합', '인산화 가능'] },
  { id: 'threonine', mr: 119, pK1: 2.11, pK2: 9.62, pKR: null, pI: 5.87, hydropathy: -0.7,
    features: ['하이드록실', '수소 결합', '인산화 가능'] },
  { id: 'cysteine', mr: 121, pK1: 1.96, pK2: 10.28, pKR: 8.18, pI: 5.07, hydropathy: 2.5,
    features: ['티올', '이황화 결합', '친핵성', '이온화 가능 곁사슬'] },
  { id: 'asparagine', mr: 132, pK1: 2.02, pK2: 8.80, pKR: null, pI: 5.41, hydropathy: -3.5,
    features: ['아마이드', '극성', '수소 결합'] },
  { id: 'glutamine', mr: 146, pK1: 2.17, pK2: 9.13, pKR: null, pI: 5.65, hydropathy: -3.5,
    features: ['아마이드', '극성', '수소 결합'] },
  { id: 'aspartic-acid', mr: 133, pK1: 1.88, pK2: 9.60, pKR: 3.65, pI: 2.77, hydropathy: -3.5,
    features: ['산성', '생리적 pH에서 주로 음전하'] },
  { id: 'glutamic-acid', mr: 147, pK1: 2.19, pK2: 9.67, pKR: 4.25, pI: 3.22, hydropathy: -3.5,
    features: ['산성', '생리적 pH에서 주로 음전하'] },
  { id: 'lysine', mr: 146, pK1: 2.18, pK2: 8.95, pKR: 10.53, pI: 9.74, hydropathy: -3.9,
    features: ['염기성 · ε-아미노기', '생리적 pH에서 주로 양전하'] },
  { id: 'histidine', mr: 155, pK1: 1.82, pK2: 9.17, pKR: 6.00, pI: 7.59, hydropathy: -3.2,
    features: ['이미다졸', '생리적 범위 근처 pKa', '양성자 전달 · 산–염기 촉매'] },
  { id: 'arginine', mr: 174, pK1: 2.17, pK2: 9.04, pKR: 12.48, pI: 10.76, hydropathy: -4.5,
    features: ['구아니디늄', '강한 염기성', '생리적 pH에서 주로 양전하'] },
];

export const AMINO_ACID_PROPERTIES: readonly AminoAcidProperty[] = REFERENCE_VALUES.map(
  (values) => ({ ...AMINO_ACID_BY_ID.get(values.id)!, ...values }),
);

export function filterProperties(category: CategoryId | 'all', search: string): AminoAcidProperty[] {
  const query = search.trim().toLocaleLowerCase('en-US');
  return AMINO_ACID_PROPERTIES.filter((acid) => {
    if (category !== 'all' && acid.category !== category) return false;
    // A single Latin letter is an exact one-letter code, e.g. G → Glycine.
    if (/^[a-z]$/.test(query)) return acid.oneLetter.toLowerCase() === query;
    return [acid.name, acid.koreanName, acid.threeLetter, acid.oneLetter]
      .some((value) => value.toLocaleLowerCase('en-US').includes(query));
  });
}
