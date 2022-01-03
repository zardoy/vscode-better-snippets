import * as vscode from 'vscode'
import stringDedent from 'string-dedent'
import { getExtensionId, getExtensionSetting, getExtensionSettingId, registerExtensionCommand, showQuickPick } from 'vscode-framework'
import { Configuration } from './configurationType'
import { jsLangs, reactLangs } from './util'
import { getSnippetsDefaults } from './extension'

export const registerCreateSnippetFromSelection = () => {
    // createNativeSnippetFromSelection
    registerExtensionCommand('createSnippetFromSelection', async () => {
        const isNativeCreator = false
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) return
        const { document } = activeEditor
        const suggestedLangs = [document.languageId]
        const allLangs = await vscode.languages.getLanguages()
        const supportedSupersetLanguages = {
            react: reactLangs,
            js: jsLangs,
        }
        const otherSupersetLangs = {}

        const foundSupportedSupersets = Object.entries(supportedSupersetLanguages).filter(([, langs]) => langs.includes(document.languageId))
        // TODO allow to pick many when global snippet file is set
        const langId =
            foundSupportedSupersets.length === 0
                ? document.languageId
                : await showQuickPick<string>([
                      ...foundSupportedSupersets.map(([superset, supsersetLangs]) => ({
                          label: superset,
                          value: superset,
                          description: `Group of ${supsersetLangs.join(', ')}`,
                      })),
                      { label: document.languageId, value: document.languageId },
                  ])
        if (langId === undefined) return
        let snippetLines = stringDedent(document.getText(activeEditor.selection)).split('\n')
        if (!activeEditor.options.insertSpaces)
            snippetLines = activeEditor.options.insertSpaces
                ? replaceTabs(snippetLines, activeEditor.options.tabSize as number)
                : snippetLines.map(line => line.replace(/\t/, '\\t'))
        const snippetName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            // TODO suggest templ if file selection
            title: 'Enter snippet name',
        })
        const snippetWhen: Configuration['customSnippets'][number]['when'] = {
            ...(getSnippetsDefaults().when.languages.includes(langId) ? null : { languages: [langId] }),
        }
        const configuration = vscode.workspace.getConfiguration(process.env.IDS_PREFIX)
        await configuration.update(
            'customSnippets',
            [
                ...(configuration.get<any[]>('customSnippets') ?? []),
                {
                    name: snippetName,
                    body: snippetLines.length === 1 ? snippetLines[0]! : snippetLines,
                    ...(Object.keys(snippetWhen).length > 0 ? { when: snippetWhen } : null),
                } as Configuration['customSnippets'][number],
            ],
            vscode.ConfigurationTarget.Global,
        )
        // TODO!
        if (getExtensionSetting('snippetCreator.showSnippetAfterCreation')) await vscode.commands.executeCommand('workbench.action.openSettingsJson')
    })
}

const replaceTabs = (lines: string[], tabSize: number) =>
    lines.map(line => line.replace(/^\s+/, match => '\\t'.repeat(match.split(' '.repeat(tabSize)).length)))
