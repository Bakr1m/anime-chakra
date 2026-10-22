// Rules + MLP ensemble. The calibrated rules are the only activation
// authority: the MLP is a synthetic-only baseline and must neither veto a
// rule match (a confident `fist`/`other` vote used to silently discard real
// hand signs) nor activate one alone (uncalibrated confidence fired jutsu
// on arbitrary real poses). The MLP still boosts agreement and confirms
// two-hand seals.
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
): [string, number] {
  const mlpVote = SINGLETON[mlpLabel] ?? 'none';
  if (rulesLabel === mlpVote) {
    return [rulesLabel, Math.max(rulesConf, mlpConf)];
  }
  if (rulesLabel !== 'none') return [rulesLabel, rulesConf];
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

/** With two hands, the MLP vote for a one-hand sign must come from the hand
 *  the rules actually matched (MediaPipe's order is arbitrary); when the
 *  rules are silent, prefer the most confident singleton vote. */
function pickPart(rulesLabel: string, parts: [[string, number], [string, number]]): [string, number] {
  if (rulesLabel !== 'none') {
    const agreed = parts.find((p) => SINGLETON[p[0]] === rulesLabel);
    if (agreed) return agreed;
  } else {
    const singletons = parts.filter((p) => (SINGLETON[p[0]] ?? 'none') !== 'none');
    if (singletons.length > 0) {
      return singletons.reduce((a, b) => (b[1] > a[1] ? b : a));
    }
  }
  return parts[0];
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
    const [mlpLabel, mlpConf] = pickPart(rulesLabel, parts);
    return ensembleSingle(rulesLabel, rulesConf, mlpLabel, mlpConf);
  }
  if (hands.length >= 1 && hands[0]) {
    const [mlpLabel, mlpConf] = predict(hands[0]);
    return ensembleSingle(rulesLabel, rulesConf, mlpLabel, mlpConf);
  }
  return ['none', 0];
}
