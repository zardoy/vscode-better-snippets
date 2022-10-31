import * as vscode from 'vscode'
import { partition } from 'rambda'
import { vscodeReadFile } from '@zardoy/vscode-utils/build/fs'
import { PackageJson } from 'type-fest'
import { parse } from 'jsonc-parser'
import { CustomSnippet, CustomTypingSnippet } from './extension'
import { Configuration } from './configurationType'

let watcher: vscode.FileSystemWatcher | undefined

type PkgDeps = Pick<PackageJson, 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies' | 'peerDependenciesMeta'>

const cachedPackageJsonsByPath = new Map</*dir*/ string, PkgDeps>()

const updatePackageJsonData = async (uri: vscode.Uri) => {
    try {
        const pkg: PackageJson = parse(await vscodeReadFile(uri))
        cachedPackageJsonsByPath.set(vscode.Uri.joinPath(uri, '..').toString(), pkg)
    } catch {}
}

const getMergedDepsForFile = (uri: vscode.Uri) => {
    const pkg: PkgDeps = {}
    const uriStringified = uri.toString()
    for (const [key, value] of cachedPackageJsonsByPath.entries()) {
        if (uriStringified.startsWith(key)) Object.assign(pkg, value)
    }

    return pkg
}

export const changeNpmDepsWatcherState = async <T extends Configuration['customSnippets'][number] | Configuration['typingSnippets'][number]>(snippets: T[]) => {
    const npmDependenciesNeeded = snippets.some(snippet => snippet.when?.npmDependencies?.length)
    if (!npmDependenciesNeeded) {
        watcher?.dispose()
    } else if (!watcher) {
        console.debug('package.json / lockfiles watcher inited')

        // const glob = `**/{${Object.values(packageManagerLockfiles).join(',')},package.json}`
        const glob = `**/package.json`
        watcher = vscode.workspace.createFileSystemWatcher(glob, false, false, false)
        watcher.onDidCreate(updatePackageJsonData)
        watcher.onDidChange(updatePackageJsonData)
        watcher.onDidDelete(uri => cachedPackageJsonsByPath.delete(uri.toString()))

        const configuration = vscode.workspace.getConfiguration()
        const defaultSearchExcludeGlob = Object.entries({ ...configuration.get('files.exclude')!, ...configuration.get('search.exclude')! })
            .filter(([key, val]: [string, boolean]) => val && !key.includes('{'))
            .map(([key]) => key)
        // we have to wait a bit to not deal with timing issues (ext host initializing)
        await new Promise(resolve => {
            setTimeout(resolve, 50)
        })
        // const tokenSource = new vscode.CancellationTokenSource()
        // setTimeout(() => tokenSource.cancel(), 800)
        try {
            console.time('[npm] search for all package.json')
            const files = await vscode.workspace.findFiles(glob, `**/{${defaultSearchExcludeGlob.join(',')}}`, 80 /* , tokenSource.token */)
            console.timeEnd('[npm] search for all package.json')
            // todo warn if either limit or timeout is reached!
            for (const uri of files) {
                // eslint-disable-next-line no-await-in-loop
                await updatePackageJsonData(uri)
            }
        } catch {}
    }
}

const getCwdUri = ({ uri }: Pick<vscode.TextDocument, 'uri'>) => {
    const allowSchemes = ['file', 'vscode-vfs']
    if (allowSchemes.includes(uri.scheme)) return vscode.Uri.joinPath(uri, '..')
    const firstWorkspace = vscode.workspace.workspaceFolders?.[0]
    return firstWorkspace?.uri
}

export const npmFilterSnippets = async <T extends CustomSnippet | CustomTypingSnippet>(document: vscode.TextDocument, snippets: T[]) => {
    let [npmSnippets, nonNpmSnippets] = partition(snippet => snippet.when.npmDependencies !== undefined, snippets)
    npmSnippets = npmSnippets.filter(({ when }) => when.npmDependencies!.length)
    if (npmSnippets.length === 0) return nonNpmSnippets
    const fileDirUri = getCwdUri(document)
    if (!fileDirUri) return nonNpmSnippets
    const pkgDeps = getMergedDepsForFile(fileDirUri)
    const allDeps = Object.keys({
        ...pkgDeps.dependencies,
        ...pkgDeps.devDependencies,
        ...pkgDeps.optionalDependencies,
    })
    // todo preserve order
    return [
        ...nonNpmSnippets,
        ...npmSnippets.filter(npmSnippet => {
            const requiredDeps = npmSnippet.when.npmDependencies!
            return requiredDeps.every(requiredDep => {
                const toCompare =
                    typeof requiredDep === 'string'
                        ? allDeps
                        : Object.keys(
                              {
                                  prod: pkgDeps.dependencies,
                                  dev: pkgDeps.devDependencies,
                              }[requiredDep.type]!,
                          )
                const depName = typeof requiredDep === 'string' ? requiredDep : requiredDep.dep
                return toCompare.includes(depName)
            })
        }),
    ]
}

const packageManagerLockfiles = {
    pnpm: 'pnpm-lock.yaml',
    yarn: 'yarn.lock',
    npm: 'package-lock.json',
}
