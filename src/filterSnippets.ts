import * as vscode from 'vscode'
import { partition } from 'rambda'
import { Configuration, SnippetLocation } from './configurationType'
import { prepareSnippetData } from './prepareSnippetData'
import { possiblyRelatedTsLocations } from './typescriptPluginIntegration'
import { npmFilterSnippets } from './npmDependencies'
import { CustomSnippet, CustomTypingSnippet } from './snippet'

// mutates on init
export const snippetsConfig: Pick<Configuration, 'strictPositionLocations' | 'enableTsPlugin'> = {} as any

const filterSnippetByLocationShared = (
    snippetLocationsInput: Array<SnippetLocation & string>,
    validLocations: SnippetLocation[],
    pickLocations?: SnippetLocation[],
) => {
    const [negativeLocations, positiveLocations] = partition<SnippetLocation>(
        loc => loc.startsWith('!'),
        pickLocations ? snippetLocationsInput.filter(loc => pickLocations.includes(loc.replace(/^!/, '') as SnippetLocation & string)) : snippetLocationsInput,
    )

    for (const positiveLocation of positiveLocations) {
        if (!validLocations.includes(positiveLocation)) return false
    }

    for (const negativeLocation of negativeLocations) {
        if (validLocations.includes(negativeLocation)) return false
    }

    // log(`Snippet ${name} included. Reason: ${location}`)
    return true
}

const phase1Locations: SnippetLocation[] = ['fileStart', 'lineStart', 'topLineStart', 'code']

// sync, should be performant so there is lower chanse of calling subsequent phases
export const filterSnippetByLocationPhase1 = <T extends CustomSnippet | CustomTypingSnippet>(
    snippet: T,
    document: vscode.TextDocument,
    position: vscode.Position,
    log: (msg: string) => any,
): boolean => {
    const lineText = snippetsConfig.strictPositionLocations
        ? document.getText(document.lineAt(position).range.with({ end: position }))
        : document.lineAt(position).text

    const validLocations: SnippetLocation[] = []

    const name = 'name' in snippet ? snippet.name : snippet.sequence
    if (position.line === 0 && name.startsWith(lineText)) validLocations.push('fileStart')
    if (name.startsWith(lineText)) validLocations.push('topLineStart')
    if (name.startsWith(lineText.trim())) validLocations.push('lineStart')

    const isPrevPosDot = (pos: vscode.Position) => pos.character > 0 && document.getText(new vscode.Range(pos.translate(0, -1), pos)) === '.'
    if (position.character === 0) {
        validLocations.push('code')
    } else if (!isPrevPosDot(position)) {
        const wordRangeAtPosition = document.getWordRangeAtPosition(position)
        if (!wordRangeAtPosition || !isPrevPosDot(wordRangeAtPosition.start)) {
            validLocations.push('code')
        }
    }

    return filterSnippetByLocationShared(snippet.when.locations, validLocations, phase1Locations)
}

export const filterWithSecondPhaseIfNeeded = async <T extends CustomSnippet | CustomTypingSnippet>(
    snippets: T[],
    document: vscode.TextDocument,
    position: vscode.Position,
): Promise<T[]> => {
    snippets = await npmFilterSnippets(document, snippets)
    if (snippets.every(snippet => snippet.when.locations.every(loc => !possiblyRelatedTsLocations.includes(loc.replace(/^!/, ''))))) return snippets
    const { validCurrentLocations } = await prepareSnippetData(document, position)
    return snippets.filter(snippet => filterSnippetByLocationShared(snippet.when.locations, validCurrentLocations, possiblyRelatedTsLocations))
}
