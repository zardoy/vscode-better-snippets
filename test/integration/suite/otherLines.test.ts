import { promises as fs } from 'fs'
import { join } from 'path'
import * as vscode from 'vscode'
import { Configuration } from '../../../src/configurationType'

describe('otherLines', () => {
    let document: vscode.TextDocument

    before(done => {
        void fs
            .readFile(join(__dirname, '../fixtures/otherLines.ts'), 'utf-8')
            .then(async content =>
                vscode.workspace.openTextDocument({
                    content,
                    language: 'markdown',
                }),
            )
            .then(async editor => {
                document = editor
                const configKey: keyof Configuration = 'customSnippets'
                const configValue: Configuration['customSnippets'] = [
                    {
                        name: 'falseyValue',
                        body: '',
                        sortText: '!',
                        when: {
                            languages: ['markdown'],
                            locations: ['fileStart'],
                        },
                    },
                ]
                await vscode.workspace.getConfiguration('betterSnippets').update(configKey, configValue, vscode.ConfigurationTarget.Global)
            })
            .then(done)
    })

    for (const iterator of /\/\/ (\d+)/g.exec(document.getText())!) {
    }
})
