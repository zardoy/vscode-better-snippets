import * as vscode from 'vscode'
import delay from 'delay'
import stringDedent from 'string-dedent'
import { getExtensionSetting, getExtensionSettingId, registerExtensionCommand, showQuickPick, VSCodeQuickPickItem } from 'vscode-framework'
import { parseTree, findNodeAtLocation } from 'jsonc-parser'
import { Configuration } from './configurationType'
import { langsEquals, langsSupersets, normalizeLanguages } from './util'
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

        const foundSupportedSupersets = Object.entries(langsSupersets).filter(([, langs]) => langs.includes(document.languageId))
        // TODO allow to pick many when global snippet file is set
        const snippetDefaults = getSnippetsDefaults()
        const defaultLanguages = normalizeLanguages(snippetDefaults.when.languages)
        const langId =
            foundSupportedSupersets.length === 0
                ? document.languageId
                : await showQuickPick<string>(
                      [
                          ...foundSupportedSupersets.map(([superset, supsersetLangs]): VSCodeQuickPickItem => {
                              const isDefault = langsEquals(defaultLanguages, supsersetLangs)
                              let description = `(${supsersetLangs.join(', ')})`
                              if (isDefault) description = `Default ${description}`
                              return {
                                  label: superset,
                                  value: superset,
                                  picked: isDefault,
                                  description,
                              }
                          }),
                          { label: document.languageId, value: document.languageId },
                      ],
                      {
                          title: 'Select language(s) in which snippet will be suggested',
                      },
                  )
        if (langId === undefined) return
        let snippetLines = stringDedent(document.getText(activeEditor.selection)).split('\n')
        if (!activeEditor.options.insertSpaces)
            snippetLines = activeEditor.options.insertSpaces
                ? replaceTabs(snippetLines, activeEditor.options.tabSize as number)
                : snippetLines.map(line => line.replace(/\t/, '\\t'))
        const snippetName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            // TODO suggest templ if file selection (though its bad idea)
            title: 'Enter name for the snippet',
        })
        if (snippetName === undefined) return
        const snippetWhen: Configuration['customSnippets'][number]['when'] = {
            ...(langsEquals(defaultLanguages, normalizeLanguages(langId)) ? null : { languages: [langId] }),
        }
        const configuration = vscode.workspace.getConfiguration(process.env.IDS_PREFIX)
        const existingCustomSnippets = configuration.get<any[]>('customSnippets') ?? []
        await configuration.update(
            'customSnippets',
            [
                ...existingCustomSnippets,
                {
                    name: snippetName,
                    body: snippetLines.length === 1 ? snippetLines[0]! : snippetLines,
                    ...(Object.keys(snippetWhen).length > 0 ? { when: snippetWhen } : null),
                } as Configuration['customSnippets'][number],
            ],
            vscode.ConfigurationTarget.Global,
        )
        if (getExtensionSetting('snippetCreator.showSnippetAfterCreation')) {
            await vscode.commands.executeCommand('workbench.action.openSettingsJson')
            const jsonSettingsEditor = vscode.window.activeTextEditor!
            const jsonSettingsDocument = jsonSettingsEditor.document
            // we've already awaited above, but not vscode
            await delay(150)
            const { offset, length } = findNodeAtLocation(parseTree(jsonSettingsDocument.getText())!, [
                getExtensionSettingId('customSnippets'),
                existingCustomSnippets.length,
            ])!
            jsonSettingsEditor.selection = new vscode.Selection(jsonSettingsDocument.positionAt(offset), jsonSettingsDocument.positionAt(offset + length))
            jsonSettingsEditor.revealRange(jsonSettingsEditor.selection)
        }
    })
}

const replaceTabs = (lines: string[], tabSize: number) =>
    lines.map(line => line.replace(/^\s+/, match => '\\t'.repeat(match.split(' '.repeat(tabSize)).length)))
