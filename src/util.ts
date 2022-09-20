import * as vscode from 'vscode'
// import ts from 'typescript'
import { normalizeRegex } from '@zardoy/vscode-utils/build/settings'
import { ensureHasProp } from '@zardoy/utils'
import { Configuration } from './configurationType'

export const normalizeFilePathRegex = (input: string, fileType: NonNullable<Configuration['customSnippets'][number]['when']>['fileType']) => {
    if (!fileType) return normalizeRegex(input)
    // eslint-disable-next-line default-case
    switch (fileType) {
        case 'package.json':
            return /\/package.json$/
        case 'tsconfig.json':
            return /\/(t|j)sconfig(\..+)?.json$/
    }
}

export const completionAddTextEdit = (completion: vscode.CompletionItem, textEdit: vscode.TextEdit) => {
    const textEdits = ensureHasProp(completion, 'additionalTextEdits', [])
    textEdits.push(textEdit)
    return textEdits
}

// const findNodeAtPosition = (source: ts.SourceFile, character: number) => {
//     const matchingNodes: INode[] = []
//     source.statements.forEach(visitNode)
//     const sortedNodes = _.orderBy(matchingNodes, [m => m.width, m => m.depth], ['asc', 'desc'])

//     return sortedNodes.length > 0 && sortedNodes

//     function visitNode(node: ts.Node, depth = 0) {
//         const start = node.getStart(source)
//         const end = node.getEnd()
//         const isToken = ts.isToken(node) && !ts.isIdentifier(node) && !ts.isTypeNode(node)

//         if (!isToken && start <= character && character < end)
//             matchingNodes.push({
//                 depth,
//                 node,
//                 width: end - start,
//             })

//         for (const n of node.getChildren(source)) visitNode(n, depth + 1)
//     }
// }

// interface INode {
//     width: number
//     depth: number
//     node: ts.Node
// }
