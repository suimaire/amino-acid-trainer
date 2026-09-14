import SmilesDrawer from 'smiles-drawer';

const THEME = {
  light: {
    C: '#182120',
    O: '#a5392d',
    N: '#245b8a',
    F: '#245b8a',
    CL: '#336b42',
    BR: '#75412d',
    I: '#5f3c81',
    P: '#8b5a12',
    S: '#9a6b00',
    B: '#b1447a',
    SI: '#7a5f43',
    H: '#182120',
    BACKGROUND: '#ffffff',
  },
};

export function renderChemicalStructures(root: ParentNode = document): void {
  const targets = root.querySelectorAll<SVGSVGElement>('svg[data-smiles]');

  targets.forEach((svg) => {
    const smiles = svg.dataset.smiles;
    if (!smiles || svg.dataset.rendered === 'true') return;

    const large = svg.dataset.size === 'large';
    const drawer = new SmilesDrawer.SvgDrawer({
      width: large ? 520 : 300,
      height: large ? 310 : 190,
      bondLength: large ? 34 : 26,
      bondThickness: 1.25,
      padding: large ? 28 : 18,
      compactDrawing: true,
      terminalCarbons: false,
      themes: THEME,
    });

    SmilesDrawer.parse(
      smiles,
      (tree) => {
        drawer.draw(tree, svg, 'light', false);
        svg.dataset.rendered = 'true';
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      },
      () => {
        svg.dataset.rendered = 'error';
        svg.replaceChildren();
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '50%');
        text.setAttribute('y', '50%');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = '구조식을 불러올 수 없습니다';
        svg.append(text);
      },
    );
  });
}

