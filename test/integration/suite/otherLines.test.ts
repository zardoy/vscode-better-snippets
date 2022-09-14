/* eslint-disable no-promise-executor-return */

import fs from 'fs'
import { join } from 'path'
import * as vscode from 'vscode'
import { Configuration } from '../../../src/configurationType'

const content = fs.readFileSync(join(__dirname, '../../test/integration/fixtures/otherLines.ts'), 'utf-8')

describe.skip('otherLines', () => {
    let documentPromise: Thenable<vscode.TextDocument>
    return

    // eslint-disable-next-line no-unreachable
    beforeAll(done => {
        console.log('basic')
        documentPromise = vscode.workspace.openTextDocument({
            content,
            language: 'typescript',
        })
        describe('Generated spec', () => {
            void documentPromise
                .then(async () => {
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
                                        testRegex: 'function|=>|React.FC',
                                        // preset: 'function',
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
                            body: '',
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
                    console.log('before update')
                    await new Promise(resolve => setTimeout(resolve, 200))
                    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
                    await vscode.workspace.getConfiguration('betterSnippets').update(configKey, configValue, vscode.ConfigurationTarget.Global)
                    console.log(2)
                    await new Promise(resolve => setTimeout(resolve, 100))
                    const activeEditor = vscode.window.activeTextEditor!
                    const toTest = [...content.matchAll(/\/\/ (\d+) ((?:!?\w ?)+)/gm)].map(item => ({
                        offset: item.index!,
                        labelBase: item[1]!,
                        cases: item[2]!.split(' '),
                    }))
                    // TODO adjust arch, think in Jest
                    for (const { labelBase, cases, offset } of toTest)
                        for (const testingCase of cases)
                            it(`${labelBase} - ${testingCase}`, async () => {
                                const document = await documentPromise
                                const activeEditor = vscode.window.activeTextEditor!
                                await activeEditor.edit(builder => {
                                    const pos = document.positionAt(offset)
                                    builder.delete(new vscode.Range(pos, pos.with({ character: Number.POSITIVE_INFINITY })))
                                })
                                await new Promise(resolve => setTimeout(resolve, 25_000))
                            })
                })
                .then(done)
        })
    })
})
