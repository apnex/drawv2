/*
THE PALETTE -- every colour this system draws, by name, in ONE place. H15.23 (B255) and the palette design ruled 2026-10-01.

Two levels, and this is the lower one:

  the palette   the colours that exist -- here, owned by the core
  roles         which palette colour each thing uses -- declared by whoever owns the thing: the product's in
                kernel/theme.mjs (`TOKENS`, `CHROME`), the network plugin's beside its appearance
                (kernel/network-appearance.mjs `NETWORK_COLOURS`)

A role names a palette entry, never a value, so a plugin owns its decision ("pipes are blue grey 400") and cannot invent
a colour: one it needs that is missing is added here, which is the one review point for the whole picture's colours.
`tools/colour-tokens.mjs --check` fails a colour value anywhere outside this file, and a role naming no entry.

THE NAMES (ruled 2026-10-01: Material, and snap the one-offs):
  Material  the Google Material Design palette, by its own names -- `lightBlue300` is Light Blue 300, exactly. Twenty-six
            colours already were; thirteen one-offs within a small distance (RGB 25) were moved to their nearest Material
            colour, a visible but slight change, recorded in dev/PRODUCTION-UPGRADE.md.
  neutral   the dark ladder Material does not provide -- its darkest grey, Grey 900, is #212121, lighter than the canvas
            itself. Named by level, `neutral10` being #101010, so the name says the value. Two pairs one level apart
            were merged (#2f2f2f into #303030, #6a6a6a into #6b6b6b).
  custom    four colours with no near Material match, kept as they were: two dark ambers and a dark green the page uses
            for status, and the socket ochre, whose nearest Material colour (Orange 300) is the transit ring's, which a
            ruling says the socket must keep clear of. (AMENDED 2026-10-02: the transit ring is Red 200 now.)
*/
const PALETTE = {
	// ---- Material ----
	red200: '#ef9a9a', red300: '#e57373', red400: '#ef5350', redA200: '#ff5252',
	deepPurpleA100: '#b388ff',
	indigo50: '#e8eaf6',
	lightBlue200: '#81d4fa', lightBlue300: '#4fc3f7',
	green400: '#66bb6a',
	lightGreen300: '#aed581',
	amber300: '#ffd54f',
	orange300: '#ffb74d', orange400: '#ffa726', orange500: '#ff9800',
	deepOrange300: '#ff8a65', deepOrangeA400: '#ff3d00',
	grey300: '#e0e0e0', grey500: '#9e9e9e', grey800: '#424242',
	blueGrey50: '#eceff1', blueGrey100: '#cfd8dc', blueGrey200: '#b0bec5', blueGrey300: '#90a4ae', blueGrey400: '#78909c',
	blueGrey700: '#455a64', blueGrey800: '#37474f', blueGrey900: '#263238',
	white: '#ffffff',
	// ---- the neutral ladder, darker than Material's greys ----
	neutral06: '#060606', neutral0a: '#0a0a0a', neutral10: '#101010', neutral18: '#181818', neutral1a: '#1a1a1a',
	neutral20: '#202020', neutral24: '#242424', neutral26: '#262626', neutral30: '#303030', neutral33: '#333333',
	neutral50: '#505050', neutral55: '#555555', neutral6b: '#6b6b6b',
	// ---- custom: no near Material match ----
	amberDim: '#4a3b00', amberDimHover: '#5a4800', greenDim: '#12180c',
	ochre: '#e0a85a',
};

// a palette entry's value; an unknown name is an error at load, so a role cannot point at nothing
export function colour(name) {
	if (!Object.hasOwn(PALETTE, name)) throw new Error(`palette has no colour named ${name}`);
	return PALETTE[name];
}

// a role's value: a palette name, or { colour, alpha } for a translucent use of one
export function resolveRole(role) {
	if (typeof role === 'string') return colour(role);
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(colour(role.colour).slice(i, i + 2), 16));
	return `rgba(${r}, ${g}, ${b}, ${role.alpha})`;
}

// a table of roles resolved to values, for the code that draws with them
export const resolveRoles = (roles) => Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, resolveRole(v)]));
