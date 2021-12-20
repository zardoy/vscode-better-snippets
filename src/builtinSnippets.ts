import { Configuration } from './configurationType'

const topLineSnippets: [string, string][] = [
    // er is much faster to type rather than ec
    ['er', 'export const $1 = '],
    ['et', 'export type $1 = '],
    ['em', 'export const ${1:method} = ($2) => {$3}'],
    ['ef', 'export { $2 } from "$1"'],
]

export const builtinSnippets: Configuration['customSnippets'] = topLineSnippets.map(([name, body]) => ({
    name,
    body,
    group: 'Builtin Better Snippet',
    type: 'Event',
    when: {
        locations: ['topLineStart'],
        languages: ['js'],
    },
}))
