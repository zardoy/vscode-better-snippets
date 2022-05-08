import * as vscode from 'vscode'
import delay from 'delay'
import { findNodeAtLocation, parseTree } from 'jsonc-parser'
import { getExtensionSettingId, registerExtensionCommand } from 'vscode-framework'

export type RevealSnippetOptions = {
    snippetIndex: number
    level?: 'global' | 'workspace'
    isTyping?: boolean
}

export const registerRevealSnippetInSettingsJson = () => {
    registerExtensionCommand('revealSnippetInSettingsJson', async (_, options?: RevealSnippetOptions & { betterSnippets: RevealSnippetOptions }) => {
        const { snippetIndex, level = 'global', isTyping = false } = options?.betterSnippets ?? options ?? {}
        const oldEditor = vscode.window.activeTextEditor
        await vscode.commands.executeCommand(level === 'global' ? 'workbench.action.openSettingsJson' : 'workbench.action.openWorkspaceSettingsFile')
        const jsonSettingsEditor = vscode.window.activeTextEditor!
        const jsonSettingsDocument = jsonSettingsEditor.document
        const sameEditor = oldEditor?.document.uri === jsonSettingsDocument.uri
        // we've already awaited above, but not vscode
        if (!sameEditor) await delay(150)
        const { offset, length } = findNodeAtLocation(parseTree(jsonSettingsDocument.getText())!, [
            getExtensionSettingId(isTyping ? 'typingSnippets' : 'customSnippets'),
            ...(snippetIndex ? [snippetIndex] : []),
        ])!
        jsonSettingsEditor.selection = new vscode.Selection(jsonSettingsDocument.positionAt(offset), jsonSettingsDocument.positionAt(offset + length))
        jsonSettingsEditor.revealRange(jsonSettingsEditor.selection)
    })
}
