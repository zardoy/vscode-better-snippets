// import ts from 'typescript'
import { Configuration } from './configurationType'

export const jsLangs = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact']
export const reactLangs = ['javascriptreact', 'typescriptreact']

export const normalizeLanguages = (language: string) => {
    if (language === 'js') return jsLangs
    if (language === 'styles') return ['css', 'scss', 'sass', 'source.css.styled']
    if (language === 'react') return reactLangs
    return language
}

// tests: https://github.com/zardoy/github-manager/tree/main/test/normalizeRegex.test.ts
export const normalizeRegex = (input: string) => {
    const regexMatch = /^\/.+\/(.*)$/.exec(input)
    if (!regexMatch) return input
    const pattern = input.slice(1, -regexMatch[1]!.length - 1)
    const flags = regexMatch[1]
    return new RegExp(pattern, flags)
}

export const normalizeFilePathRegex = (input: string, fileType: NonNullable<Configuration['customSnippets'][number]['when']>['fileType']) => {
    if (!fileType) return normalizeRegex(input)
    // eslint-disable-next-line default-case
    switch (fileType) {
        case 'package.json':
            return /package.json$/
        case 'tsconfig.json':
            return /(t|j)sconfig(\..+)?.json$/
    }
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
