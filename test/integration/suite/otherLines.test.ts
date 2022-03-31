import fs from 'fs'
import { join } from 'path'
import * as vscode from 'vscode'
import { Configuration } from '../../../src/configurationType'

const content = fs.readFileSync(join(__dirname, '../fixtures/otherLines.ts'), 'utf-8')

describe('otherLines', () => {
    let document: vscode.TextDocument

    before(done => {
        void vscode.workspace
            .openTextDocument({
                content,
                language: 'markdown',
            })
            .then(async editor => {
                document = editor
                const configKey: keyof Configuration = 'customSnippets'
                const configValue: Configuration['customSnippets'] = [
                    {
                        name: 'reactHook',
                        body: '',
                        sortText: '!',
                        when: {
                            locations: ['lineStart'],
                            otherLines: [
                                {
                                    indent: -1,
                                    preset: 'function',
                                },
                            ],
                        },
                    },
                    {
                        // actually should a typing snippet
                        name: 'c',
                        body: 'countinue',
                        sortText: '!',
                        when: {
                            // locations: [],
                            otherLines: [
                                {
                                    indent: -1,
                                    testString: 'for',
                                },
                            ],
                        },
                    },
                    {
                        // actually should a typing snippet
                        name: 'f',
                        body: '\n} else {\n',
                        sortText: '!',
                        when: {
                            // locations: [],
                            otherLines: [
                                {
                                    indent: -1,
                                    testString: 'if',
                                },
                            ],
                        },
                    },
                ]
                await vscode.workspace.getConfiguration('betterSnippets').update(configKey, configValue, vscode.ConfigurationTarget.Global)
            })
            .then(done)
    })

    const toTest = [...content.matchAll(/\/\/ (\d+) ((?:!?\w ?)+)/gm)].map(item => ({
        position: document.positionAt(item.index!),
        labelBase: item[1]!,
        cases: item[2]!.split(' '),
    }))
    for (const { labelBase, cases, position } of toTest) for (const testingCase of cases) test(`${labelBase} - ${testingCase}`)
})
