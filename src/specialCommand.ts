import * as vscode from 'vscode'
import { basename } from 'path-browserify'
import { oneOf, stringTrimUntil } from '@zardoy/utils'
import { getExtensionCommandId, getExtensionSetting, registerExtensionCommand } from 'vscode-framework'
import { CompletionInsertArg } from './completionInsert'

export const registerSpecialCommand = () => {
    registerExtensionCommand('applySpecialSnippet', async (_, specialCommand: string) => {
        if (typeof specialCommand !== 'string') throw new Error('First arg (specialCommand) must be string')
        switch (specialCommand) {
            case 'useParam': {
                const activeEditor = vscode.window.activeTextEditor!
                const fileName = stringTrimUntil(basename(activeEditor.document.uri.path), '.')
                const fileSymbols: vscode.SymbolInformation[] = await vscode.commands.executeCommand(
                    'vscode.executeDocumentSymbolProvider',
                    activeEditor.document.uri,
                )
                const fileNameSymbol = fileSymbols.find(
                    ({ name, kind }) =>
                        name === fileName && oneOf(kind, vscode.SymbolKind.Constant, vscode.SymbolKind.Variable, vscode.SymbolKind.Function),
                )
                if (!fileNameSymbol) return
                const componentUsage: vscode.Location[] = await vscode.commands.executeCommand(
                    'vscode.executeReferenceProvider',
                    activeEditor.document.uri,
                    fileNameSymbol.location.range.start,
                )
                const externalUsages = componentUsage.filter(({ uri }) => uri.toString() !== activeEditor.document.uri.toString())
                if (externalUsages.length < 2) return
                const fileContents = await vscode.workspace.fs.readFile(externalUsages[0]!.uri)
                const fileLines = fileContents.toString().split('\n')
                // first one is always import, they're ordered
                const usageLine = fileLines[externalUsages[1]!.range.start.line]!
                const paramMatch = /:(.+?)[/"']/.exec(usageLine)?.[1]
                if (!paramMatch) return
                const snippet = new vscode.SnippetString('const ')
                snippet.appendPlaceholder(`{ ${paramMatch} }`, 2)
                snippet.appendText(` = useParams`)
                snippet.appendText(getExtensionSetting('useParamMode') === 'cast' ? `() as { ${paramMatch}: string }` : `<'${paramMatch}'>()`)

                const insertPos = activeEditor.selection.end
                await activeEditor.insertSnippet(snippet)
                const arg: CompletionInsertArg = {
                    action: 'resolve-imports',
                    importsConfig: {
                        useParams: {
                            package: 'react-router-dom',
                        },
                    },
                    insertPos,
                    snippetLines: 1,
                }
                await vscode.commands.executeCommand(getExtensionCommandId('completionInsert'), arg)
                break
            }

            default:
                throw new Error(`There is no special command for ${specialCommand}`)
        }
    })
}
