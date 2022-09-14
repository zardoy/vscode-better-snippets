import * as vscode from 'vscode'
import { Configuration } from '../../../src/configurationType'
import { clearEditorText } from './utils'

describe('Create snippet', () => {
    let editor: vscode.TextEditor
    let document: vscode.TextDocument

    beforeAll(done => {
        void vscode.commands.executeCommand('workbench.action.files.newUntitledFile').then(async () => {
            editor = vscode.window.activeTextEditor!
            document = editor.document
            await vscode.languages.setTextDocumentLanguage(document, 'markdown')
            await vscode.workspace
                .getConfiguration('betterSnippets')
                .update('snippetCreator.showSnippetAfterCreation', false, vscode.ConfigurationTarget.Global)
            await vscode.workspace.getConfiguration('betterSnippets').update('customSnippets', [], vscode.ConfigurationTarget.Global)
            done()
        })
    }, 6000)

    const insertTestSnippet = async () => clearEditorText(editor, 'function test() {\n\t0\t1\n\t\t2\n}')

    it('Create snippet from selection', async () => {
        await insertTestSnippet()
        editor.selection = new vscode.Selection(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end)
        let snippetName = 'createdSnippet1'
        await vscode.commands.executeCommand('betterSnippets.createSnippetFromSelection', snippetName)
        const assertSnippet = (snippetName: string) => {
            const configValue = vscode.workspace.getConfiguration('betterSnippets').get<Configuration['customSnippets']>('customSnippets')!
            const lastSnippet = configValue.slice(-1)[0]
            expect(lastSnippet?.name /* , snippetName */).toEqual(snippetName)
            expect(lastSnippet?.body /* , snippetName */).toEqual(['function test() {', '\t0\t1', '\t\t2', '}'])
        }

        assertSnippet(snippetName)
        snippetName = 'createdSnippet2'
        await vscode.commands.executeCommand('editor.action.indentationToTabs')
        await vscode.commands.executeCommand('betterSnippets.createSnippetFromSelection', snippetName)
        assertSnippet(snippetName)
    })
})
