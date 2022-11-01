import * as vscode from 'vscode'
import _ from 'lodash'

export const clearEditorText = async (editor: vscode.TextEditor, resetContent = '') => {
    await new Promise<void>(resolve => {
        const { document } = editor
        if (document.getText() === resetContent) {
            resolve()
            return
        }

        const { dispose } = vscode.workspace.onDidChangeTextDocument(({ document }) => {
            if (document.uri !== editor.document.uri) return
            dispose()
            resolve()
        })
        void editor.edit(builder =>
            builder.replace(new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end), resetContent),
        )
    })
}

export const getCompletionItems = async (pos?: vscode.Position) => {
    const { document: doc, selection } = vscode.window.activeTextEditor!
    if (!pos) pos = selection.active
    const { items }: { items: vscode.CompletionItem[] } = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, pos)
    return items
}

export const getFirstCompletionItem = async (pos: vscode.Position) =>
    getCompletionItems(pos).then(items => {
        const item = _.sortBy(items, c => c.sortText ?? c.label)[0]
        return item && { ...item, label: normalizeCompletionItemLabel(item.label) }
    })

export const normalizeCompletionItemLabel = (label: vscode.CompletionItem['label']) => (typeof label === 'string' ? label : label.label)
