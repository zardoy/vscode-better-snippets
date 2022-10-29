import * as vscode from 'vscode'
import { SnippetLocation } from './configurationType'
import { getValidTsRelatedLocations } from './typescriptPluginIntegration'

export interface PreparedSnippetData {
    validCurrentLocations: SnippetLocation[]
}

export const prepareSnippetData = async (textDocument: vscode.TextDocument, position: vscode.Position): Promise<PreparedSnippetData> => {
    const tsRelatedLocations = await getValidTsRelatedLocations(textDocument, position)
    return {
        validCurrentLocations: tsRelatedLocations,
    }
}
