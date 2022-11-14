import dedent from 'string-dedent'
import { getExtensionCommandId } from 'vscode-framework'
import { Configuration, CustomSnippetUnresolved } from './configurationType'

const topLineSnippets: Array<[string, string]> = [
    // er is much faster to type rather than ec
    ['er', 'export const $1 = '],
    ['et', 'export type $1 = '],
    ['em', 'export const ${1:method} = ($2) => {$3}'],
    ['ef', 'export { $2 } from "$1"'],
    ['ed', 'export default '],
]

const markdownTop = {
    locations: ['topLineStart'],
    languages: ['markdown'],
}

// todo set required: languages
export const builtinSnippets: CustomSnippetUnresolved[] = (
    [
        // js
        ...topLineSnippets.map(
            ([name, body]): CustomSnippetUnresolved => ({
                name,
                body,
                iconType: 'Event',
                when: {
                    locations: ['topLineStart'],
                    languages: ['js'],
                },
            }),
        ),
        {
            name: 'useParam',
            body: '',
            // experimentaly
            iconType: 'Event',
            executeCommand: {
                command: getExtensionCommandId('_applySpecialSnippet' as any),
                arguments: ['useParam'],
            },
            when: {
                locations: ['lineStart'],
                languages: ['react'],
                otherLines: [
                    {
                        indent: -1,
                        testRegex: 'function|=>|React.FC',
                    },
                ],
            },
        },
        // md
        {
            name: 'ts',
            body: '```ts\n$1\n```',
            when: markdownTop,
        },
        {
            name: 'tsx',
            body: '```tsx\n$1\n```',
            when: markdownTop,
        },
        {
            name: 'codeblock',
            body: '```$1\n$2\n```',
            when: markdownTop,
        },
        {
            name: 'dropdown',
            body: dedent`
              <details>
              <summary>$1</summary>

              $2
              </details>
            `,
            when: markdownTop,
        },
    ] as CustomSnippetUnresolved[]
).map((snippet): CustomSnippetUnresolved => ({ description: 'Builtin Better Snippet', ...snippet }))
