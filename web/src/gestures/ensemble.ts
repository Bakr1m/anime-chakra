// Rules + MLP ensemble. Agreement -> label; disagreement needs
// disagreeMinConfidence (0.9), else none. Single-hand decision space is
// {rasengan, chidori, none}; tiger/cross/open/fist/other all vote none.
import type { Landmark } from './features';
import { predict } from './mlp';
import { classify } from './rules';
import { getSpec, type GestureSpec } from './spec';

const SINGLETON: Record<string, string> = {
  rasengan: 'rasengan',
  chidori: 'chidori',
  tiger: 'none',
  cross: 'none',
  open: 'none',
  fist: 'none',
  other: 'none',
};

export function ensembleSingle(
  rulesLabel: string,
  rulesConf: number,
  mlpLabel: string,
  mlpConf: number,
  spec: GestureSpec,
): [string, number] {
  const mlpVote = SINGLETON[mlpLabel] ?? 'none';
  if (rulesLabel === mlpVote) {
    return [rulesLabel, Math.max(rulesConf, mlpConf)];
  }
  const gate = spec.reliability.disagreeMinConfidence;
  if (rulesLabel !== 'none' && rulesConf >= gate && mlpConf < gate) return [rulesLabel, rulesConf];
  if (mlpVote !== 'none' && mlpConf >= gate && rulesConf < gate) return [mlpVote, mlpConf];
  return ['none', 0];
}

/** Two-hand seals need the geometric rules; consistent MLP parts confirm. */
export function ensembleTwoHand(
  rulesLabel: string,
  partLabels: [string, string],
  rulesConf: number,
): [string, number] {
  if (rulesLabel !== 'katon' && rulesLabel !== 'bunshin') return [rulesLabel, rulesConf];
  const want = rulesLabel === 'katon' ? 'tiger' : 'cross';
  const consistent = partLabels[0] === want && partLabels[1] === want;
  return [rulesLabel, consistent ? 1.0 : 0.8];
}

/** Full pipeline decision for 1-2 hands. Pure rules when model is null. */
export function classifyEnsemble(hands: Landmark[][], spec?: GestureSpec): [string, number] {
  const s = spec ?? getSpec();
  const [rulesLabel, rulesConf] = classify(hands, s);
  if (hands.length === 2 && hands[0] && hands[1]) {
    const parts = [predict(hands[0]), predict(hands[1])] as [[string, number], [string, number]];
    if (rulesLabel === 'katon' || rulesLabel === 'bunshin') {
      return ensembleTwoHand(rulesLabel, [parts[0][0], parts[1][0]], rulesConf);
    }
    const [label, conf] = ensembleSingle(rulesLabel, rulesConf, parts[0][0], parts[0][1], s);
    return [label, conf];
  }
  if (hands.length >= 1 && hands[0]) {
    const [mlpLabel, mlpConf] = predict(hands[0]);
    return ensembleSingle(rulesLabel, rulesConf, mlpLabel, mlpConf, s);
  }
  return ['none', 0];
}
