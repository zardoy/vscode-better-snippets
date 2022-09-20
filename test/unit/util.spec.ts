import { normalizeLanguages as normalizeLanguagesOriginal, areLangsEquals, defaultLanguageSupersets } from '@zardoy/vscode-utils/build/langs'
import { vi } from 'vitest'

vi.mock('vscode', () => ({}))

// After refactoring, now its weird that lib function being tested there

const normalizeLanguages = (langs: string | string[]) => normalizeLanguagesOriginal(langs, defaultLanguageSupersets)

test('normalizeLanguages', () => {
    expect(normalizeLanguages('javascriptreact')).toMatchInlineSnapshot(`
      [
        "javascriptreact",
      ]
    `)
    expect(normalizeLanguages('*')).toMatchInlineSnapshot(`
      [
        "*",
      ]
    `)
    expect(normalizeLanguages('js')).toMatchInlineSnapshot(`
      [
        "typescript",
        "javascript",
        "typescriptreact",
        "javascriptreact",
      ]
    `)
    expect(normalizeLanguages(['typescriptreact', 'typescript', 'ts', 'styles'])).toMatchInlineSnapshot(`
      [
        "typescriptreact",
        "typescript",
        "typescript",
        "typescriptreact",
        "css",
        "scss",
        "sass",
        "source.css.styled",
      ]
    `)
    expect(normalizeLanguages([])).toMatchInlineSnapshot('[]')
})

test('areLangsEquals', () => {
    expect(areLangsEquals(defaultLanguageSupersets.js, normalizeLanguages('js'))).toMatchInlineSnapshot(`true`)
})
