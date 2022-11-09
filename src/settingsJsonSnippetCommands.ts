import * as vscode from 'vscode'
import { findNodeAtLocation, parseTree } from 'jsonc-parser'
import { getExtensionSettingId, registerExtensionCommand, Settings } from 'vscode-framework'
import { findCustomArray } from '@zardoy/utils'
import { CustomSnippetUnresolved, TypingSnippetUnresolved } from './configurationType'

export type CommonSnippet = CustomSnippetUnresolved | TypingSnippetUnresolved
export const getSnippetsSettingValue = (configKey: keyof Settings, isLocal: boolean) => {
    const {
        globalValue = [],
        workspaceValue = [],
        workspaceFolderValue = [],
    } = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, null).inspect<any[]>(configKey)!
    const settingValue: CommonSnippet[] = isLocal ? [...workspaceValue, ...workspaceFolderValue] : globalValue
    return settingValue
}

export type RevealSnippetOptions = {
    snippetIndex: number
    level?: 'global' | 'workspace'
    isTyping?: boolean
}

export const registerSnippetSettingsJsonCommands = () => {
    registerExtensionCommand(
        'revealSnippetInSettingsJson',
        async (_, options?: RevealSnippetOptions & { /* handle tree item */ betterSnippets: RevealSnippetOptions }) => {
            const { snippetIndex, level = 'global', isTyping = false } = options?.betterSnippets ?? options ?? {}
            await new Promise<void>(resolve => {
                const checkEditor = (editor?: vscode.TextEditor) => {
                    if (editor?.document.uri.path.endsWith('/settings.json')) {
                        resolve()
                        return true
                    }

                    return false
                }

                void vscode.commands.executeCommand(level === 'global' ? 'workbench.action.openSettingsJson' : 'workbench.action.openWorkspaceSettingsFile')
                if (!checkEditor(vscode.window.activeTextEditor)) vscode.window.onDidChangeActiveTextEditor(editor => checkEditor(editor))
            })
            const jsonSettingsEditor = vscode.window.activeTextEditor!
            const jsonSettingsDocument = jsonSettingsEditor.document
            const rootNode = parseTree(jsonSettingsDocument.getText())
            const tryGetPaths: Array<Array<string | number>> = snippetIndex === undefined ? [] : [[snippetIndex, 'body'], [snippetIndex]]
            const { offset, length } = findCustomArray(
                tryGetPaths,
                path => findNodeAtLocation(rootNode!, [getExtensionSettingId(isTyping ? 'typingSnippets' : 'customSnippets'), ...path])!,
            )!
            const pos = jsonSettingsDocument.positionAt(offset)
            jsonSettingsEditor.selection = new vscode.Selection(pos, pos)
            jsonSettingsEditor.revealRange(jsonSettingsEditor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
        },
    )

    registerExtensionCommand('removeSnippet', async (_, { betterSnippets }: { /* handle tree item */ betterSnippets: RevealSnippetOptions }) => {
        if (!betterSnippets) return
        const { snippetIndex, level, isTyping } = betterSnippets
        const key = isTyping ? 'typingSnippets' : 'customSnippets'
        const currentSnippets = getSnippetsSettingValue(key, level === 'workspace')
        await vscode.workspace.getConfiguration(process.env.IDS_PREFIX, null).update(
            key,
            currentSnippets.filter((_s, i) => i !== snippetIndex),
            level === 'global' ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace,
        )
    })
}
