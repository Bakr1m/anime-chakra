import gesturesJson from '../../../spec/gestures.json';

export interface JutsuRules {
  [key: string]: number | boolean | string;
}

export interface JutsuDef {
  id: string;
  displayName: string;
  character: string;
  hands: number;
  needsSegmentation: boolean;
  needsFace: boolean;
  kind: string;
  cooldownSeconds: number;
  holdSeconds?: number;
  stretch?: boolean;
  webOnly?: boolean;
  colors: Record<string, string>;
  rules: JutsuRules;
}

export interface GestureSpec {
  version: number;
  reliability: {
    activateFrames: number;
    releaseFrames: number;
    minConfidence: number;
    chargeSeconds: number;
  };
  jutsu: JutsuDef[];
}

function validate(spec: GestureSpec): void {
  const ids = new Set(spec.jutsu.map((j) => j.id));
  for (const need of ['rasengan', 'chidori', 'katon', 'bunshin']) {
    if (!ids.has(need)) throw new Error(`spec missing jutsu: ${need}`);
  }
}

const spec = gesturesJson as unknown as GestureSpec;
validate(spec);

export function getSpec(): GestureSpec {
  return spec;
}

export function rulesFor(spec: GestureSpec, id: string): JutsuRules {
  const found = spec.jutsu.find((j) => j.id === id);
  if (!found) throw new Error(`unknown jutsu: ${id}`);
  return found.rules;
}
