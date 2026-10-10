// Touch-first HUD: jutsu cards with hand-sign hints, charge meter, onboarding.
export interface CardDef {
  id: string;
  name: string;
  character: string;
  hint: string;
}

export const CARDS: CardDef[] = [
  { id: 'rasengan', name: 'Rasengan', character: 'Naruto', hint: 'Palm to camera, fingers cupped' },
  { id: 'chidori', name: 'Chidori', character: 'Sasuke', hint: 'Knife hand, flat, sideways' },
  { id: 'katon', name: 'Katon: Gokakyu', character: 'Sasuke / Itachi', hint: 'Tiger seal, two hands, hold' },
  { id: 'bunshin', name: 'Kage Bunshin', character: 'Naruto', hint: 'Cross seal, fingers in an X' },
  { id: 'sharingan', name: 'Sharingan', character: 'Sasuke', hint: 'Point at your eye' },
  { id: 'kurama', name: 'Kurama Cloak', character: 'Naruto', hint: 'Both fists raised high' },
];

export class JutsuCards {
  private root: HTMLElement;
  private bars = new Map<string, HTMLElement>();
  private cards = new Map<string, HTMLElement>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'cards';
    for (const c of CARDS) {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset['id'] = c.id;
      el.innerHTML = `<div class="card-name">${c.name}</div><div class="card-hint">${c.hint}</div><div class="meter"><div class="fill"></div></div>`;
      this.root.appendChild(el);
      this.cards.set(c.id, el);
      const fill = el.querySelector<HTMLElement>('.fill');
      if (fill) this.bars.set(c.id, fill);
    }
    const help = document.createElement('div');
    help.className = 'onboard';
    help.textContent = 'Hold a hand sign steady. Cards light up when a jutsu fires.';
    this.root.appendChild(help);
    parent.appendChild(this.root);
    window.setTimeout(() => help.classList.add('fade'), 9000);
  }

  update(activeId: string | null, charge: number): void {
    for (const [id, el] of this.cards) {
      el.classList.toggle('active', id === activeId);
      const bar = this.bars.get(id);
      if (bar) bar.style.width = id === activeId ? `${Math.round(charge * 100)}%` : '0%';
    }
  }
}
